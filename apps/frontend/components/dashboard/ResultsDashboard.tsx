'use client';
import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { subscribeRealtime } from '@/lib/realtime';
import type { ResultCategoryCode, ResultsSnapshot } from '@/lib/types';
import { useRegionalAdmin } from '@/hooks/useRegionalAdmin';
import { RegionalHeader } from './RegionalHeader';
import { ResultCategoryCircles } from './ResultCategoryCircles';
import { StatusPill } from '../StatusPill';
import { downloadCsv, downloadXlsx, printTableReport } from '@/lib/exporters';

const codes: ResultCategoryCode[] = ['PAM','PI','RNI','PJD','USFP','MP','REJECTED'];
const labels: Record<ResultCategoryCode,string> = { PAM:'PAM', PI:'PI', RNI:'RNI', PJD:'PJD', USFP:'USFP', MP:'MP', REJECTED:'Rejetés' };
const phoneHref = (phone?: string | null) => phone ? `tel:${phone.replace(/[^+\d]/g,'')}` : undefined;

export function ResultsDashboard() {
  const { me, loading: authLoading } = useRegionalAdmin();
  const [snapshot, setSnapshot] = useState<ResultsSnapshot | null>(null);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  async function load() { try { setSnapshot(await apiFetch<ResultsSnapshot>('/api/dashboard/results')); setError(''); } catch(e){setError(e instanceof Error?e.message:'Erreur');} }
  useEffect(()=>{ if(me) load(); },[me]);
  useEffect(()=>{
    if(!me) return;
    let timer: number | undefined;
    return subscribeRealtime(topic => {
      if(!['results','settings','admin'].includes(topic)) return;
      window.clearTimeout(timer);
      timer=window.setTimeout(load,180);
    });
  },[me]);

  const rows=useMemo(()=>{
    const t=search.toLowerCase().trim();
    return (snapshot?.bureaus??[]).filter(b=>!t||b.code.toLowerCase().includes(t)||b.name.toLowerCase().includes(t)||b.observer?.full_name.toLowerCase().includes(t)||b.observer?.phone?.toLowerCase().includes(t));
  },[snapshot,search]);

  if(authLoading||!me) return <main className="grid min-h-screen place-items-center">Chargement…</main>;
  if(!snapshot) return <><RegionalHeader electionMode={me.electionMode} userName={me.user.full_name}/><main className="p-6">{error||'Chargement…'}</main></>;

  const received=snapshot.bureaus.filter(b=>!!b.result).length;
  const missing=snapshot.bureaus.length-received;
  const pendingCorrections=snapshot.bureaus.reduce((n,b)=>n+(b.result?.corrections?.length??0),0);
  const final=received===snapshot.bureaus.length && snapshot.bureaus.length>0 && pendingCorrections===0;

  async function resolveCorrection(id:string,approve:boolean){
    if(!window.confirm(approve?'Approuver cette correction ?':'Refuser cette correction ?')) return;
    await apiFetch(`/api/results/corrections/${id}/resolve`,{method:'POST',body:JSON.stringify({approve})});await load();
  }

  const makeExportRows=()=>snapshot.bureaus.map(b=>({
    bureau:`${b.code} — ${b.name}`,
    observateur:b.observer?.full_name??'',
    telephone:b.observer?.phone??'',
    PAM:b.result?.values.PAM??'', PI:b.result?.values.PI??'', RNI:b.result?.values.RNI??'', PJD:b.result?.values.PJD??'', USFP:b.result?.values.USFP??'', MP:b.result?.values.MP??'', REJECTED:b.result?.values.REJECTED??'',
    statut:b.result?.status??'RESULTAT ATTENDU', confirmation:b.result?.confirmed_at?new Date(b.result.confirmed_at).toLocaleString('fr-MA'):''
  }));
  const exportColumns=[{header:'Bureau local',key:'bureau'},{header:'Observateur',key:'observateur'},{header:'Téléphone',key:'telephone'},...codes.map(code=>({header:labels[code],key:code})),{header:'Statut',key:'statut'},{header:'Heure confirmation',key:'confirmation'}];

  return <div className="min-h-screen bg-slate-50">
    <RegionalHeader electionMode={snapshot.electionMode} userName={me.user.full_name}/>
    <main className="mx-auto max-w-[1500px] p-4 sm:p-6">
      <div className="mb-5 grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">Bureaux ayant transmis</p><p className="mt-2 text-4xl font-black">{received}<span className="text-lg text-slate-400"> / {snapshot.bureaus.length}</span></p></div>
        <div className="rounded-3xl bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">Résultats encore attendus</p><p className="mt-2 text-4xl font-black text-red-700">{missing}</p></div>
        <div className="rounded-3xl bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">Corrections en attente</p><p className="mt-2 text-4xl font-black text-amber-700">{pendingCorrections}</p></div>
      </div>

      {final && <div className="mb-5 rounded-3xl border border-emerald-200 bg-emerald-50 p-6 text-center"><p className="text-sm font-bold uppercase tracking-wider text-emerald-700">Tous les bureaux locaux ont transmis leurs résultats ciblés</p><p className="mt-2 text-sm text-emerald-900">Les totaux par parti/catégorie ci-dessous sont les données internes remontées par les observateurs. Aucun total général n’est calculé.</p></div>}

      <ResultCategoryCircles categories={snapshot.categories} totals={snapshot.categoryTotals}/>

      <div className="my-5 flex flex-wrap gap-2">
        <button onClick={()=>downloadCsv('resultats-cibles.csv',exportColumns,makeExportRows())} className="rounded-xl border bg-white px-4 py-2 text-sm font-semibold">CSV</button>
        <button onClick={async()=>await downloadXlsx('resultats-cibles.xlsx','Résultats',exportColumns,makeExportRows())} className="rounded-xl border bg-white px-4 py-2 text-sm font-semibold">Excel</button>
        <button onClick={()=>printTableReport('Résultats ciblés — rapport régional',exportColumns,makeExportRows())} className="rounded-xl border bg-white px-4 py-2 text-sm font-semibold">PDF / Imprimer</button>
        <button onClick={()=>{const er=snapshot.bureaus.filter(b=>!b.result).map(b=>({bureau:`${b.code} — ${b.name}`,observateur:b.observer?.full_name??'',telephone:b.observer?.phone??''}));downloadCsv('resultats-manquants.csv',[{header:'Bureau local',key:'bureau'},{header:'Observateur',key:'observateur'},{header:'Téléphone',key:'telephone'}],er)}} className="rounded-xl border bg-white px-4 py-2 text-sm font-semibold">Bureaux sans résultats</button>
      </div>

      <div className="rounded-2xl bg-white p-4 shadow-sm"><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Rechercher bureau, observateur ou téléphone…" className="h-11 w-full rounded-xl border border-slate-300 px-4"/></div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="overflow-x-auto"><table className="w-full min-w-[1500px] text-left text-sm"><thead className="bg-slate-100 text-xs uppercase text-slate-500"><tr><th className="p-4">Bureau local</th><th className="p-4">Observateur</th><th className="p-4">Téléphone</th>{codes.map(c=><th key={c} className="p-4 text-right">{labels[c]}</th>)}<th className="p-4">Statut</th><th className="p-4">Correction</th></tr></thead><tbody>
        {rows.map(b=><tr key={b.id} className="border-t border-slate-100"><td className="p-4"><strong>{b.code}</strong><div className="text-slate-500">{b.name}</div></td><td className="p-4">{b.observer?.full_name??'—'}</td><td className="p-4">{b.observer?.phone?<a className="font-bold text-blue-700 underline" href={phoneHref(b.observer.phone)}>☎ {b.observer.phone}</a>:<span className="text-slate-400">—</span>}</td>{codes.map(c=><td key={c} className="p-4 text-right text-lg font-black tabular-nums">{b.result?.values[c]??'—'}</td>)}<td className="p-4">{!b.result?<StatusPill tone="red">Résultat attendu</StatusPill>:b.result.status==='CONFIRMED'?<StatusPill tone="green">Confirmé</StatusPill>:<StatusPill tone="orange">{b.result.status==='CORRECTED'?'Corrigé':'Correction en attente'}</StatusPill>}</td><td className="p-4">{b.result?.corrections?.length?<div className="space-y-3">{b.result.corrections.map(c=><div key={c.id} className="max-w-md rounded-xl bg-amber-50 p-3"><p className="font-bold">{labels[c.category_code]} : {c.old_value} → {c.proposed_value}</p><p className="text-xs text-slate-600">{c.reason}</p><div className="mt-2 flex gap-2"><button onClick={()=>resolveCorrection(c.id,true)} className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white">Approuver</button><button onClick={()=>resolveCorrection(c.id,false)} className="rounded-lg bg-red-700 px-3 py-2 text-xs font-bold text-white">Refuser</button></div></div>)}</div>:'—'}</td></tr>)}
      </tbody></table></div></div>
    </main>
  </div>;
}
