'use client';
import { useEffect, useMemo, useState } from 'react';
import { apiFetch, ApiError } from '@/lib/api';
import { enqueueResult, getPendingResults, removePendingResult, type PendingResult } from '@/lib/offlineQueue';
import type { ElectionMode, MeResponse, ResultCategoryCode, ResultValues } from '@/lib/types';
import { StatusPill } from './StatusPill';

const categories: Array<{ code: ResultCategoryCode; label: string }> = [
  { code: 'PAM', label: 'PAM' },
  { code: 'PI', label: 'PI' },
  { code: 'RNI', label: 'RNI' },
  { code: 'PJD', label: 'PJD' },
  { code: 'USFP', label: 'USFP' },
  { code: 'MP', label: 'MP' },
  { code: 'REJECTED', label: 'Rejetés / non comptabilisés' }
];

const blankInputs = () => Object.fromEntries(categories.map(c => [c.code, ''])) as Record<ResultCategoryCode, string>;

type Props = {
  localBureauId: string;
  bureauName: string;
  electionMode: ElectionMode;
  initialResult: MeResponse['result'];
  onResultChange?: () => void;
};

export function ObserverResultForm({ localBureauId, bureauName, electionMode, initialResult, onResultChange }: Props) {
  const [result, setResult] = useState(initialResult);
  const [inputs, setInputs] = useState<Record<ResultCategoryCode, string>>(() => {
    if (!initialResult) return blankInputs();
    return Object.fromEntries(categories.map(c => [c.code, String(initialResult.values[c.code] ?? 0)])) as Record<ResultCategoryCode, string>;
  });
  const [status, setStatus] = useState<'idle'|'syncing'|'offline'|'error'>('idle');
  const [message, setMessage] = useState('');
  const [showCorrection, setShowCorrection] = useState(false);
  const [correctionCategory, setCorrectionCategory] = useState<ResultCategoryCode>('PAM');
  const [proposedVotes, setProposedVotes] = useState('');
  const [reason, setReason] = useState('');

  const canSubmit = electionMode === 'COUNTING' && !result;
  const pendingCorrection = useMemo(() => result?.corrections?.some(c => c.status === 'PENDING') ?? false, [result]);

  useEffect(() => {
    setResult(initialResult);
    if (initialResult) {
      setInputs(Object.fromEntries(categories.map(c => [c.code, String(initialResult.values[c.code] ?? 0)])) as Record<ResultCategoryCode, string>);
    }
  }, [initialResult]);

  function parseResults(): ResultValues | null {
    const parsed: Partial<ResultValues> = {};
    for (const category of categories) {
      const raw = inputs[category.code].trim();
      if (raw === '') {
        setStatus('error');
        setMessage(`Saisissez le résultat pour ${category.label}.`);
        return null;
      }
      const value = Number(raw);
      if (!Number.isInteger(value) || value < 0) {
        setStatus('error');
        setMessage(`La valeur ${category.label} doit être un entier positif ou zéro.`);
        return null;
      }
      parsed[category.code] = value;
    }
    return parsed as ResultValues;
  }

  async function send(op: PendingResult) {
    return apiFetch<{ ok: true; result: NonNullable<MeResponse['result']> }>('/api/results/confirm', {
      method: 'POST', body: JSON.stringify(op)
    });
  }

  async function confirmResult() {
    const values = parseResults();
    if (!values) return;
    const lines = categories.map(c => `${c.label} : ${values[c.code]}`).join('\n');
    if (!window.confirm(`Confirmer définitivement les résultats ciblés du bureau ${bureauName} ?\n\n${lines}\n\nAprès confirmation, une correction nécessitera une demande.`)) return;

    const op: PendingResult = {
      operationUuid: crypto.randomUUID(),
      localBureauId,
      results: values,
      createdAt: new Date().toISOString()
    };
    setStatus('syncing'); setMessage('');
    try {
      const response = await send(op);
      setResult(response.result);
      setStatus('idle');
      setMessage('✓ Résultats transmis au bureau régional.');
      onResultChange?.();
    } catch (error) {
      if (error instanceof ApiError) { setStatus('error'); setMessage(error.message); return; }
      await enqueueResult(op);
      setStatus('offline');
      setMessage('Résultats conservés sur cet appareil. Synchronisation en attente…');
    }
  }

  useEffect(() => {
    async function flush() {
      if (!navigator.onLine || result) return;
      for (const op of await getPendingResults()) {
        if (op.localBureauId !== localBureauId) continue;
        try {
          setStatus('syncing');
          const response = await send(op);
          setResult(response.result);
          setInputs(Object.fromEntries(categories.map(c => [c.code, String(response.result.values[c.code] ?? 0)])) as Record<ResultCategoryCode, string>);
          await removePendingResult(op.operationUuid);
          setStatus('idle');
          setMessage('✓ Résultats synchronisés et transmis au bureau régional.');
          onResultChange?.();
        } catch (error) {
          if (error instanceof ApiError) { setStatus('error'); setMessage(error.message); }
          else { setStatus('offline'); setMessage('Synchronisation en attente…'); }
          break;
        }
      }
    }
    flush();
    window.addEventListener('online', flush);
    return () => window.removeEventListener('online', flush);
  }, [localBureauId, result]);

  async function requestCorrection() {
    if (!result) return;
    const proposed = Number(proposedVotes);
    if (!Number.isInteger(proposed) || proposed < 0 || reason.trim().length < 3) {
      setStatus('error'); setMessage('Nouvelle valeur et motif obligatoires.'); return;
    }
    try {
      await apiFetch('/api/results/corrections', {
        method: 'POST',
        body: JSON.stringify({ submissionId: result.id, categoryCode: correctionCategory, proposedVotes: proposed, reason })
      });
      setResult({ ...result, status: 'CORRECTION_PENDING' });
      setShowCorrection(false);
      setProposedVotes(''); setReason('');
      setMessage(`Demande de correction ${correctionCategory} transmise au bureau régional.`);
      onResultChange?.();
    } catch (error) { setStatus('error'); setMessage(error instanceof Error ? error.message : 'Erreur'); }
  }

  return <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
    <div className="flex items-start justify-between gap-3">
      <div><p className="text-xs font-bold uppercase tracking-wider text-slate-500">COUNTING — Dépouillement</p><h2 className="mt-1 text-xl font-black">Résultats ciblés du bureau</h2></div>
      <StatusPill tone={electionMode === 'COUNTING' ? 'orange' : result ? 'green' : 'slate'}>{result ? 'TRANSMIS' : electionMode}</StatusPill>
    </div>

    <p className="mt-3 text-sm text-slate-600">Saisissez uniquement les voix des catégories suivies. D’autres partis peuvent exister : aucun total global n’est calculé et aucune comparaison n’est faite avec la participation.</p>

    <div className="mt-5 grid gap-3 sm:grid-cols-2">
      {categories.map(category => <label key={category.code} className={category.code === 'REJECTED' ? 'sm:col-span-2' : ''}>
        <span className="mb-1 block text-sm font-bold text-slate-700">{category.label}</span>
        <input
          value={inputs[category.code]}
          onChange={e => setInputs(prev => ({ ...prev, [category.code]: e.target.value.replace(/[^0-9]/g, '') }))}
          disabled={!canSubmit}
          inputMode="numeric"
          placeholder="0"
          className="h-14 w-full rounded-xl border border-slate-300 px-4 text-xl font-black tabular-nums disabled:bg-slate-100"
        />
      </label>)}
    </div>

    {!result && <button onClick={confirmResult} disabled={!canSubmit || status === 'syncing'} className="mt-5 h-14 w-full rounded-2xl bg-slate-950 font-black text-white disabled:cursor-not-allowed disabled:bg-slate-300">
      {electionMode === 'COUNTING' ? 'VÉRIFIER ET CONFIRMER LES RÉSULTATS' : 'Disponible pendant COUNTING'}
    </button>}

    {result && <div className="mt-5 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-900">
      <strong>✓ Résultats transmis au bureau régional.</strong><br />
      Les valeurs sont verrouillées. Toute modification passe par une demande de correction.
    </div>}

    {result && !pendingCorrection && !showCorrection && <button onClick={() => setShowCorrection(true)} className="mt-4 text-sm font-semibold text-blue-700 underline">Demander une correction</button>}
    {pendingCorrection && <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-800">Une demande de correction est en attente de traitement par le bureau régional.</p>}

    {showCorrection && <div className="mt-4 space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
      <label><span className="mb-1 block text-sm font-semibold">Catégorie à corriger</span><select value={correctionCategory} onChange={e => setCorrectionCategory(e.target.value as ResultCategoryCode)} className="h-12 w-full rounded-xl border border-slate-300 bg-white px-3">{categories.map(c=><option key={c.code} value={c.code}>{c.label}</option>)}</select></label>
      <p className="text-xs text-slate-600">Valeur actuellement enregistrée : <b>{result?.values[correctionCategory] ?? 0}</b></p>
      <input value={proposedVotes} onChange={e => setProposedVotes(e.target.value.replace(/[^0-9]/g, ''))} className="h-12 w-full rounded-xl border border-slate-300 px-3" placeholder="Nouvelle valeur" inputMode="numeric" />
      <textarea value={reason} onChange={e => setReason(e.target.value)} className="min-h-24 w-full rounded-xl border border-slate-300 p-3" placeholder="Motif de la correction" />
      <div className="flex gap-2"><button onClick={() => setShowCorrection(false)} className="h-11 flex-1 rounded-xl bg-white font-semibold">Annuler</button><button onClick={requestCorrection} className="h-11 flex-1 rounded-xl bg-amber-700 font-semibold text-white">Envoyer</button></div>
    </div>}

    {status === 'syncing' && <p className="mt-3 text-sm text-blue-700">⏳ Synchronisation…</p>}
    {status === 'offline' && <p className="mt-3 text-sm text-amber-700">⚠ {message}</p>}
    {status === 'error' && <p className="mt-3 text-sm text-red-700">{message}</p>}
    {status === 'idle' && message && <p className="mt-3 text-sm text-slate-600">{message}</p>}
  </section>;
}
