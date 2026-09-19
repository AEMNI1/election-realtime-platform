'use client';
import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { subscribeRealtime } from '@/lib/realtime';
import type { ParticipationBureau, ParticipationSnapshot } from '@/lib/types';
import { useRegionalAdmin } from '@/hooks/useRegionalAdmin';
import { RegionalHeader } from './RegionalHeader';
import { StatusPill } from '../StatusPill';
import { ParticipationEvolutionChart } from './ParticipationEvolutionChart';
import { downloadCsv, downloadXlsx, printTableReport } from '@/lib/exporters';

function activityStatus(row: ParticipationBureau, thresholds: ParticipationSnapshot['thresholds']) {
  if (!row.presence?.last_seen_at) return 'INACTIVE';
  const minutes = (Date.now() - new Date(row.presence.last_seen_at).getTime()) / 60000;
  if (minutes <= thresholds.orange_minutes) return 'ACTIVE';
  if (minutes <= thresholds.red_minutes) return 'ATTENTION';
  return 'INACTIVE';
}

export function ParticipationDashboard() {
  const { me, loading: authLoading } = useRegionalAdmin();
  const [snapshot, setSnapshot] = useState<ParticipationSnapshot | null>(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'ALL'|'ACTIVE'|'ATTENTION'|'INACTIVE'>('ALL');
  const [, setTick] = useState(0);
  const [evolution, setEvolution] = useState<Array<{at:string;total:number}>>([]);

  useEffect(() => { const id = setInterval(()=>setTick(v=>v+1), 30_000); return()=>clearInterval(id); }, []);
  async function load() {
    try {
      const [p, e] = await Promise.all([
        apiFetch<ParticipationSnapshot>('/api/dashboard/participation'),
        apiFetch<{points:Array<{at:string;total:number}>}>('/api/dashboard/evolution')
      ]);
      setSnapshot(p); setEvolution(e.points); setError('');
    } catch (err) { setError(err instanceof Error ? err.message : 'Erreur de chargement'); }
  }

  useEffect(() => { if (me) load(); }, [me]);

  useEffect(() => {
    if (!me) return;
    let timer: number | undefined;
    return subscribeRealtime(topic => {
      if (!['participation','presence','settings','admin'].includes(topic)) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(load, 150);
    });
  }, [me]);

  const rows = useMemo(() => {
    if (!snapshot) return [];
    const term = search.trim().toLowerCase();
    return snapshot.bureaus.filter(row => {
      const status = activityStatus(row, snapshot.thresholds);
      const matchFilter = filter === 'ALL' || filter === status;
      const matchSearch = !term || row.name.toLowerCase().includes(term) || row.code.toLowerCase().includes(term) || row.observer?.full_name.toLowerCase().includes(term) || row.observer?.phone?.toLowerCase().includes(term);
      return matchFilter && matchSearch;
    });
  }, [snapshot, search, filter]);

  if (authLoading || !me) return <main className="grid min-h-screen place-items-center">Chargement…</main>;
  if (!snapshot) return <><RegionalHeader electionMode={me.electionMode} userName={me.user.full_name}/><main className="mx-auto max-w-7xl p-6">{error || 'Chargement des données…'}</main></>;

  const total = snapshot.bureaus.reduce((sum,b)=>sum+b.currentCount,0);
  const active = snapshot.bureaus.filter(b=>activityStatus(b,snapshot.thresholds)==='ACTIVE').length;
  const attention = snapshot.bureaus.filter(b=>activityStatus(b,snapshot.thresholds)==='ATTENTION').length;
  const inactive = snapshot.bureaus.length-active-attention;

  return <div className="min-h-screen bg-slate-50">
    <RegionalHeader electionMode={snapshot.electionMode} userName={me.user.full_name}/>
    <main className="mx-auto max-w-7xl p-4 sm:p-6">
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-3xl bg-slate-950 p-6 text-white md:col-span-2"><p className="text-sm font-semibold text-slate-300">TOTAL PARTICIPATION OBSERVÉE</p><p className="mt-2 text-5xl font-black tabular-nums">{total.toLocaleString('fr-MA')}</p><p className="mt-3 text-xs text-slate-400">Données internes des observateurs — mise à jour temps réel</p></div>
        <div className="rounded-3xl bg-white p-6 shadow-sm"><p className="text-sm text-slate-500">Bureaux actifs</p><p className="mt-2 text-4xl font-black text-emerald-700">{active}<span className="text-lg text-slate-400"> / {snapshot.bureaus.length}</span></p></div>
        <div className="rounded-3xl bg-white p-6 shadow-sm"><p className="text-sm text-slate-500">À surveiller / inactifs</p><p className="mt-2 text-4xl font-black text-amber-700">{attention + inactive}</p><p className="mt-2 text-xs text-slate-500">{attention} attention · {inactive} inactifs</p></div>
      </div>

      <div className="mt-6"><ParticipationEvolutionChart points={evolution}/></div>

      <div className="mt-5 flex flex-wrap gap-2">
        <button onClick={()=>{const exportRows=snapshot.bureaus.map(b=>({bureau:`${b.code} — ${b.name}`,observateur:b.observer?.full_name??'',telephone:b.observer?.phone??'',participants:b.currentCount,derniere_presence:b.presence?.last_seen_at?new Date(b.presence.last_seen_at).toLocaleString('fr-MA'):''}));downloadCsv('participation.csv',[{header:'Bureau local',key:'bureau'},{header:'Observateur',key:'observateur'},{header:'Téléphone',key:'telephone'},{header:'Participation observée',key:'participants'},{header:'Dernière présence',key:'derniere_presence'}],exportRows)}} className="rounded-xl border bg-white px-4 py-2 text-sm font-semibold">CSV</button>
        <button onClick={async()=>{const exportRows=snapshot.bureaus.map(b=>({bureau:`${b.code} — ${b.name}`,observateur:b.observer?.full_name??'',telephone:b.observer?.phone??'',participants:b.currentCount,derniere_presence:b.presence?.last_seen_at?new Date(b.presence.last_seen_at).toLocaleString('fr-MA'):''}));await downloadXlsx('participation.xlsx','Participation',[{header:'Bureau local',key:'bureau'},{header:'Observateur',key:'observateur'},{header:'Téléphone',key:'telephone'},{header:'Participation observée',key:'participants'},{header:'Dernière présence',key:'derniere_presence'}],exportRows)}} className="rounded-xl border bg-white px-4 py-2 text-sm font-semibold">Excel</button>
        <button onClick={()=>{const exportRows=snapshot.bureaus.map(b=>({bureau:`${b.code} — ${b.name}`,observateur:b.observer?.full_name??'',telephone:b.observer?.phone??'',participants:b.currentCount,derniere_presence:b.presence?.last_seen_at?new Date(b.presence.last_seen_at).toLocaleString('fr-MA'):''}));printTableReport('Participation observée — rapport régional',[{header:'Bureau local',key:'bureau'},{header:'Observateur',key:'observateur'},{header:'Téléphone',key:'telephone'},{header:'Participation observée',key:'participants'},{header:'Dernière présence',key:'derniere_presence'}],exportRows)}} className="rounded-xl border bg-white px-4 py-2 text-sm font-semibold">PDF / Imprimer</button>
      </div>

      <div className="mt-6 flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm sm:flex-row">
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Rechercher bureau, observateur ou téléphone…" className="h-11 flex-1 rounded-xl border border-slate-300 px-4"/>
        <select value={filter} onChange={e=>setFilter(e.target.value as any)} className="h-11 rounded-xl border border-slate-300 px-4"><option value="ALL">Tous les statuts</option><option value="ACTIVE">Actifs</option><option value="ATTENTION">Attention</option><option value="INACTIVE">Inactifs</option></select>
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto"><table className="w-full min-w-[1050px] text-left text-sm"><thead className="bg-slate-100 text-xs uppercase text-slate-500"><tr><th className="p-4">Bureau local</th><th className="p-4">Observateur</th><th className="p-4">Téléphone</th><th className="p-4 text-right">Participants</th><th className="p-4">Dernière présence</th><th className="p-4">Statut</th></tr></thead><tbody>
          {rows.map(row => { const st=activityStatus(row,snapshot.thresholds); return <tr key={row.id} className="border-t border-slate-100"><td className="p-4"><strong>{row.code}</strong><div className="text-slate-500">{row.name}</div></td><td className="p-4">{row.observer?.full_name ?? <span className="text-red-600">Non affecté</span>}</td><td className="p-4">{row.observer?.phone ? <a href={`tel:${row.observer.phone.replace(/[^+\d]/g,'')}`} className="font-bold text-blue-700 underline">☎ {row.observer.phone}</a> : <span className="text-slate-400">—</span>}</td><td className="p-4 text-right text-2xl font-black tabular-nums">{row.currentCount}</td><td className="p-4 text-slate-500">{row.presence?.last_seen_at ? new Date(row.presence.last_seen_at).toLocaleTimeString('fr-MA') : 'Aucun signal'}</td><td className="p-4">{st==='ACTIVE'?<StatusPill tone="green">● Actif</StatusPill>:st==='ATTENTION'?<StatusPill tone="orange">● Attention</StatusPill>:<StatusPill tone="red">● Inactif</StatusPill>}</td></tr> })}
        </tbody></table></div>
      </div>
    </main>
  </div>;
}
