'use client';
import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { subscribeRealtime } from '@/lib/realtime';
import type { ElectionMode, ParticipationSnapshot, ResultsSnapshot } from '@/lib/types';
import { useRegionalAdmin } from '@/hooks/useRegionalAdmin';
import { RegionalHeader } from './RegionalHeader';
import { StatusPill } from '../StatusPill';
import { downloadCsv, downloadXlsx, printTableReport } from '@/lib/exporters';

export function ControlCenter() {
  const { me, loading: authLoading } = useRegionalAdmin();
  const [participation, setParticipation] = useState<ParticipationSnapshot | null>(null);
  const [results, setResults] = useState<ResultsSnapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    try {
      const [p, r] = await Promise.all([
        apiFetch<ParticipationSnapshot>('/api/dashboard/participation'),
        apiFetch<ResultsSnapshot>('/api/dashboard/results')
      ]);
      setParticipation(p); setResults(r); setError('');
    } catch (e) { setError(e instanceof Error ? e.message : 'Erreur de chargement'); }
  }

  useEffect(()=>{ if(me) load(); },[me]);
  useEffect(()=>{ if(!me) return; const id=setInterval(load,30_000); return()=>clearInterval(id); },[me]);
  useEffect(()=>{ if(!me) return; let timer:number|undefined; return subscribeRealtime(()=>{window.clearTimeout(timer);timer=window.setTimeout(load,150)}); },[me]);

  const alerts = useMemo(() => {
    if (!participation || !results) return [] as string[];
    const now=Date.now(); const red=participation.thresholds.red_minutes*60_000;
    const inactive=participation.bureaus.filter(b=>!b.presence?.last_seen_at || now-new Date(b.presence.last_seen_at).getTime()>red);
    const missingObservers=participation.bureaus.filter(b=>!b.observer);
    const pendingCorrections=results.bureaus.filter(b=>b.result?.status==='CORRECTION_PENDING');
    const out:string[]=[];
    if(missingObservers.length) out.push(`${missingObservers.length} bureau(x) local(aux) sans observateur actif.`);
    if(inactive.length) out.push(`${inactive.length} observateur(s) sans présence récente.`);
    if(pendingCorrections.length) out.push(`${pendingCorrections.length} correction(s) de résultat à traiter.`);
    return out;
  },[participation,results]);

  async function changeMode(mode: ElectionMode) {
    const warning = mode==='COUNTING' ? 'Passer en COUNTING désactive la saisie de participation et ouvre la saisie des résultats. Continuer ?' : mode==='COMPLETED' ? 'Passer en COMPLETED verrouille les opérations normales. Continuer ?' : `Passer le système en mode ${mode} ?`;
    if(!window.confirm(warning)) return;
    setBusy(true);
    try { await apiFetch('/api/dashboard/election-mode',{method:'POST',body:JSON.stringify({mode})}); await load(); }
    catch(e){setError(e instanceof Error?e.message:'Erreur');}
    finally{setBusy(false);}
  }

  if(authLoading||!me) return <main className="grid min-h-screen place-items-center">Chargement…</main>;
  const mode=participation?.electionMode ?? me.electionMode;
  const connected=participation?.bureaus.filter(b=>b.presence?.connection_status==='CONNECTED').length??0;
  const received=results?.bureaus.filter(b=>!!b.result).length??0;
  const totalBureaus=participation?.bureaus.length??0;
  const recentUpdates=participation?.bureaus.filter(b=>b.counterUpdatedAt && Date.now()-new Date(b.counterUpdatedAt).getTime()<=5*60_000).length??0;

  return <div className="min-h-screen bg-slate-50">
    <RegionalHeader electionMode={mode} userName={me.user.full_name}/>
    <main className="mx-auto max-w-7xl p-4 sm:p-6">
      <div className="rounded-3xl bg-slate-950 p-6 text-white">
        <p className="text-sm font-bold uppercase tracking-wider text-slate-400">Mode jour d'élection</p>
        <div className="mt-4 flex flex-wrap gap-3">
          {(['PREPARATION','VOTING','COUNTING','COMPLETED'] as ElectionMode[]).map(m=><button key={m} disabled={busy||m===mode} onClick={()=>changeMode(m)} className={`rounded-xl px-4 py-3 text-sm font-bold ${m===mode?'bg-white text-slate-950':'bg-slate-800 text-white hover:bg-slate-700'} disabled:cursor-not-allowed`}>{m}</button>)}
        </div>
        <p className="mt-4 text-xs text-slate-400">PREPARATION = test connexion · VOTING = participation · COUNTING = résultats · COMPLETED = clôture.</p>
      </div>

      {error&&<div className="mt-4 rounded-2xl bg-red-50 p-4 text-red-700">{error}</div>}
      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-3xl bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">Connectés maintenant</p><p className="mt-2 text-4xl font-black">{connected}<span className="text-lg text-slate-400"> / {totalBureaus}</span></p></div>
        <div className="rounded-3xl bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">Données reçues ≤ 5 min</p><p className="mt-2 text-4xl font-black">{recentUpdates}</p></div>
        <div className="rounded-3xl bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">Résultats reçus</p><p className="mt-2 text-4xl font-black">{received}<span className="text-lg text-slate-400"> / {results?.bureaus.length??0}</span></p></div>
        <div className="rounded-3xl bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">Alertes prioritaires</p><p className="mt-2 text-4xl font-black text-amber-700">{alerts.length}</p></div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2"><button onClick={async()=>{const a=await apiFetch<{rows:any[]}>('/api/dashboard/audit');const rows=a.rows.map(r=>({date:new Date(r.created_at).toLocaleString('fr-MA'),action:r.action,type:r.entity_type??'',entity:r.entity_id??'',metadata:JSON.stringify(r.metadata??{})}));downloadCsv('audit.csv',[{header:'Date',key:'date'},{header:'Action',key:'action'},{header:'Type',key:'type'},{header:'Entité',key:'entity'},{header:'Métadonnées',key:'metadata'}],rows)}} className="rounded-xl border bg-white px-4 py-2 text-sm font-semibold">Audit CSV</button><button onClick={async()=>{const a=await apiFetch<{rows:any[]}>('/api/dashboard/audit');const rows=a.rows.map(r=>({date:new Date(r.created_at).toLocaleString('fr-MA'),action:r.action,type:r.entity_type??'',entity:r.entity_id??'',metadata:JSON.stringify(r.metadata??{})}));await downloadXlsx('audit.xlsx','Audit',[{header:'Date',key:'date'},{header:'Action',key:'action'},{header:'Type',key:'type'},{header:'Entité',key:'entity'},{header:'Métadonnées',key:'metadata'}],rows)}} className="rounded-xl border bg-white px-4 py-2 text-sm font-semibold">Audit Excel</button><button onClick={async()=>{const a=await apiFetch<{rows:any[]}>('/api/dashboard/audit');const rows=a.rows.map(r=>({date:new Date(r.created_at).toLocaleString('fr-MA'),action:r.action,type:r.entity_type??'',entity:r.entity_id??''}));printTableReport('Journal d’audit',[{header:'Date',key:'date'},{header:'Action',key:'action'},{header:'Type',key:'type'},{header:'Entité',key:'entity'}],rows)}} className="rounded-xl border bg-white px-4 py-2 text-sm font-semibold">Audit PDF / Imprimer</button></div>

      <section className="mt-5 rounded-3xl bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between"><h2 className="text-xl font-black">Alertes prioritaires</h2><StatusPill tone={alerts.length?'orange':'green'}>{alerts.length?`${alerts.length} alerte(s)`:'Situation normale'}</StatusPill></div>
        <div className="mt-4 space-y-3">{alerts.length?alerts.map((a,i)=><div key={i} className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">⚠ {a}</div>):<div className="rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-800">✓ Aucun signal prioritaire détecté.</div>}</div>
      </section>
    </main>
  </div>;
}
