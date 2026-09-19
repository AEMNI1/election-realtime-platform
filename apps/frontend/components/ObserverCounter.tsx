'use client';
import { useEffect, useState } from 'react';
import { apiFetch, ApiError } from '@/lib/api';
import { getDeviceId } from '@/lib/device';
import { enqueueParticipation, getPendingParticipation, removePendingParticipation, type PendingParticipation } from '@/lib/offlineQueue';
import type { ElectionMode } from '@/lib/types';
import { StatusPill } from './StatusPill';

type Props = {
  localBureauId: string;
  serverCount: number;
  updatedAt?: string | null;
  electionMode: ElectionMode;
  onCountChange?: (value: number) => void;
};

type SyncState = 'idle' | 'syncing' | 'synced' | 'offline' | 'error';

export function ObserverCounter({ localBureauId, serverCount, updatedAt, electionMode, onCountChange }: Props) {
  const [base, setBase] = useState(serverCount);
  const [delta, setDelta] = useState(0);
  const [status, setStatus] = useState<SyncState>('idle');
  const [message, setMessage] = useState('');
  const [lastConfirmed, setLastConfirmed] = useState<string | null>(updatedAt ?? null);
  const displayed = Math.max(0, base + delta);
  const enabled = electionMode === 'VOTING';

  useEffect(() => setBase(serverCount), [serverCount]);

  async function send(op: PendingParticipation) {
    return apiFetch<{ ok: true; currentCount: number; serverTime: string }>('/api/participation/confirm', {
      method: 'POST',
      body: JSON.stringify(op)
    });
  }

  async function confirm() {
    if (!enabled || delta === 0) return;
    if (delta <= -5 && !window.confirm(`Vous êtes sur le point de diminuer le compteur de ${Math.abs(delta)}. Confirmer ?`)) return;

    const op: PendingParticipation = {
      operationUuid: crypto.randomUUID(),
      localBureauId,
      delta,
      deviceId: getDeviceId(),
      createdAt: new Date().toISOString()
    };
    setStatus('syncing');
    setMessage('');

    try {
      const result = await send(op);
      setBase(result.currentCount);
      setDelta(0);
      setLastConfirmed(result.serverTime);
      setStatus('synced');
      setMessage('Mise à jour enregistrée');
      onCountChange?.(result.currentCount);
    } catch (error) {
      if (error instanceof ApiError) {
        setStatus('error');
        setMessage(error.message);
        return;
      }
      await enqueueParticipation(op);
      setBase(displayed);
      setDelta(0);
      setStatus('offline');
      setMessage('Synchronisation en attente…');
      onCountChange?.(displayed);
    }
  }

  useEffect(() => {
    async function flush() {
      if (!navigator.onLine) return;
      const pending = await getPendingParticipation();
      for (const op of pending) {
        if (op.localBureauId !== localBureauId) continue;
        try {
          setStatus('syncing');
          const result = await send(op);
          setBase(result.currentCount);
          setLastConfirmed(result.serverTime);
          await removePendingParticipation(op.operationUuid);
          setStatus('synced');
          setMessage('Synchronisation terminée');
          onCountChange?.(result.currentCount);
        } catch (error) {
          if (error instanceof ApiError) {
            setStatus('error');
            setMessage(error.message);
          } else {
            setStatus('offline');
            setMessage('Hors connexion');
          }
          break;
        }
      }
    }
    flush();
    window.addEventListener('online', flush);
    return () => window.removeEventListener('online', flush);
  }, [localBureauId]);

  return <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Phase 1</p>
        <h2 className="mt-1 text-xl font-bold">Participation constatée</h2>
      </div>
      {enabled ? <StatusPill tone="green">Ouverte</StatusPill> : <StatusPill>Inactive</StatusPill>}
    </div>

    <div className="my-7 text-center text-7xl font-black tabular-nums sm:text-8xl">{displayed}</div>
    <div className="grid grid-cols-2 gap-4">
      <button disabled={!enabled || displayed <= 0} className="h-24 rounded-2xl bg-slate-200 text-4xl font-bold disabled:opacity-40" onClick={() => setDelta(d => Math.max(-base, d - 1))}>−1</button>
      <button disabled={!enabled} className="h-24 rounded-2xl bg-blue-700 text-4xl font-bold text-white disabled:opacity-40" onClick={() => setDelta(d => d + 1)}>+1</button>
    </div>

    {delta !== 0 && <p className="mt-4 text-center text-sm font-semibold text-blue-700">Modification en attente : {delta > 0 ? '+' : ''}{delta}</p>}
    <button disabled={!enabled || delta === 0 || status === 'syncing'} onClick={confirm} className="mt-5 h-16 w-full rounded-2xl bg-slate-950 text-lg font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">
      {status === 'syncing' ? 'SYNCHRONISATION…' : 'CONFIRMER'}
    </button>

    <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4 text-sm">
      <span className="text-slate-500">Dernière confirmation : {lastConfirmed ? new Date(lastConfirmed).toLocaleTimeString('fr-MA') : '—'}</span>
      {status === 'synced' && <StatusPill tone="green">✓ Synchronisé</StatusPill>}
      {status === 'syncing' && <StatusPill tone="blue">⏳ Synchronisation</StatusPill>}
      {status === 'offline' && <StatusPill tone="orange">⚠ Hors connexion</StatusPill>}
      {status === 'error' && <StatusPill tone="red">Erreur</StatusPill>}
    </div>
    {message && <p className={`mt-3 text-sm ${status === 'error' ? 'text-red-700' : 'text-slate-600'}`}>{message}</p>}
  </section>;
}
