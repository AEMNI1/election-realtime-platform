'use client';
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { subscribeRealtime } from '@/lib/realtime';
import { useRegionalAdmin } from '@/hooks/useRegionalAdmin';
import { RegionalHeader } from './RegionalHeader';
import { downloadCsv } from '@/lib/exporters';
import type { AdminBureau, AdminUser } from '@/lib/types';

type ImportRow = { bureauCode:string; bureauName:string; bureauAddress?:string; username:string; password:string; observerName:string; phone?:string; email?:string };
type ResultRow = { bureauCode?:string; username?:string; observerName?:string; status?:string; message?:string };

const aliases: Record<string, keyof ImportRow> = {
  'code bureau':'bureauCode','bureau code':'bureauCode','bureaucode':'bureauCode','code_bureau':'bureauCode',
  'nom bureau':'bureauName','bureau name':'bureauName','bureauname':'bureauName','nom_bureau':'bureauName',
  'adresse bureau':'bureauAddress','bureau address':'bureauAddress','bureauaddress':'bureauAddress','adresse_bureau':'bureauAddress',
  'username':'username','identifiant':'username','login':'username',
  'password':'password','mot de passe':'password','mot_de_passe':'password',
  'nom observateur':'observerName','observer name':'observerName','observername':'observerName','nom_observateur':'observerName',
  'email':'email','e-mail':'email','telephone':'phone','téléphone':'phone','phone':'phone'
};
const norm=(v:any)=>String(v??'').trim().toLowerCase();

function rowsFromMatrix(matrix:any[][]): ImportRow[] {
  if(matrix.length<2) return [];
  const headers=matrix[0].map(norm).map(h=>aliases[h]??null);
  return matrix.slice(1).filter(r=>r.some(v=>String(v??'').trim())).map(r=>{
    const out:any={}; headers.forEach((key,i)=>{if(key) out[key]=String(r[i]??'').trim();}); return out as ImportRow;
  }).filter(r=>r.bureauCode&&r.bureauName&&r.username&&r.password&&r.observerName);
}
function parseCsv(text:string): any[][] {
  const rows:any[][]=[]; let row:string[]=[]; let cur=''; let quoted=false;
  for(let i=0;i<text.length;i++){const c=text[i]; if(c==='"'){if(quoted&&text[i+1]==='"'){cur+='"';i++;}else quoted=!quoted;} else if((c===';'||c===',')&&!quoted){row.push(cur);cur='';} else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cur);if(row.some(x=>x.trim()))rows.push(row);row=[];cur='';} else cur+=c;} row.push(cur);if(row.some(x=>x.trim()))rows.push(row); return rows;
}

export function AdminImport(){
  const {me,loading}=useRegionalAdmin();
  const [bureaux,setBureaux]=useState<AdminBureau[]>([]);
  const [users,setUsers]=useState<AdminUser[]>([]);
  const [error,setError]=useState(''); const [notice,setNotice]=useState(''); const [busy,setBusy]=useState(false);
  const [bureauForm,setBureauForm]=useState({code:'',name:'',address:''});
  const [userForm,setUserForm]=useState({username:'',password:'',fullName:'',localBureauId:'',phone:'',email:''});
  const [rows,setRows]=useState<ImportRow[]>([]); const [results,setResults]=useState<ResultRow[]>([]);

  async function load(){
    try{
      const [b,u]=await Promise.all([apiFetch<{rows:AdminBureau[]}>('/api/admin/bureaux'),apiFetch<{rows:AdminUser[]}>('/api/admin/users')]);
      setBureaux(b.rows);setUsers(u.rows);setError('');
    }catch(e){setError(e instanceof Error?e.message:'Erreur de chargement')}
  }
  useEffect(()=>{if(me)load()},[me]);
  useEffect(()=>{if(!me)return;let t:number|undefined;return subscribeRealtime(topic=>{if(topic!=='admin')return;window.clearTimeout(t);t=window.setTimeout(load,150)})},[me]);

  const freeBureaux=useMemo(()=>bureaux.filter(b=>b.active&&!b.observer),[bureaux]);

  async function createBureau(e:FormEvent){e.preventDefault();setBusy(true);setError('');setNotice('');try{await apiFetch('/api/admin/bureaux',{method:'POST',body:JSON.stringify(bureauForm)});setBureauForm({code:'',name:'',address:''});setNotice('Bureau local ajouté.');await load()}catch(err){setError(err instanceof Error?err.message:'Erreur')}finally{setBusy(false)}}
  async function createObserver(e:FormEvent){e.preventDefault();setBusy(true);setError('');setNotice('');try{await apiFetch('/api/admin/users',{method:'POST',body:JSON.stringify({...userForm,email:userForm.email.trim()||null,phone:userForm.phone.trim()||null,role:'OBSERVER',active:true})});setUserForm({username:'',password:'',fullName:'',localBureauId:'',phone:'',email:''});setNotice('Observateur créé et affecté au bureau.');await load()}catch(err){setError(err instanceof Error?err.message:'Erreur')}finally{setBusy(false)}}
  async function toggleBureau(b:AdminBureau){if(!window.confirm(`${b.active?'Désactiver':'Activer'} le bureau ${b.code} ?`))return;try{await apiFetch(`/api/admin/bureaux/${b.id}`,{method:'PATCH',body:JSON.stringify({active:!b.active})});await load()}catch(e){setError(e instanceof Error?e.message:'Erreur')}}
  async function toggleUser(u:AdminUser){if(!window.confirm(`${u.active?'Désactiver':'Activer'} ${u.full_name} ?`))return;try{await apiFetch(`/api/admin/users/${u.id}`,{method:'PATCH',body:JSON.stringify({active:!u.active})});await load()}catch(e){setError(e instanceof Error?e.message:'Erreur')}}
  async function resetPassword(u:AdminUser){const password=window.prompt(`Nouveau mot de passe temporaire pour ${u.username} (minimum 8 caractères) :`);if(!password)return;try{await apiFetch(`/api/admin/users/${u.id}/reset-password`,{method:'POST',body:JSON.stringify({password})});setNotice(`Mot de passe de ${u.username} réinitialisé. Ses sessions ont été révoquées.`)}catch(e){setError(e instanceof Error?e.message:'Erreur')}}

  async function fileChanged(e:ChangeEvent<HTMLInputElement>){const file=e.target.files?.[0];if(!file)return;setError('');setResults([]);try{if(file.name.toLowerCase().endsWith('.xlsx')){const mod=await import('exceljs');const ExcelJS:any=(mod as any).default??mod;const wb=new ExcelJS.Workbook();await wb.xlsx.load(await file.arrayBuffer());const ws=wb.worksheets[0];const matrix:any[][]=[];ws.eachRow({ includeEmpty: false }, (r: any) => {const vals=(r.values as any[]).slice(1).map(v=>typeof v==='object'&&v&&'text'in v?(v as any).text:v);matrix.push(vals)});setRows(rowsFromMatrix(matrix));}else{setRows(rowsFromMatrix(parseCsv(await file.text())));}}catch(err){setError(err instanceof Error?err.message:'Fichier illisible')}}
  async function submitImport(){if(!rows.length)return;setBusy(true);setError('');try{const r=await apiFetch<any>('/api/admin/import-observers',{method:'POST',body:JSON.stringify({rows})});setResults(r.results??[]);await load()}catch(e){setError(e instanceof Error?e.message:'Erreur import')}finally{setBusy(false)}}
  function template(){downloadCsv('modele-import-observateurs.csv',[{header:'Code bureau',key:'bureauCode'},{header:'Nom bureau',key:'bureauName'},{header:'Adresse bureau',key:'bureauAddress'},{header:'Username',key:'username'},{header:'Password',key:'password'},{header:'Nom observateur',key:'observerName'},{header:'Téléphone',key:'phone'},{header:'Email',key:'email'}],[{bureauCode:'BL-001',bureauName:'Bureau local 001',bureauAddress:'',username:'observer001',password:'Temp-2026!',observerName:'Nom Prénom',phone:'0600000000',email:''}]);}

  if(loading||!me)return <main className="grid min-h-screen place-items-center">Chargement…</main>;
  return <div className="min-h-screen bg-slate-50"><RegionalHeader electionMode={me.electionMode} userName={me.user.full_name}/><main className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
    {(error||notice)&&<div className={`rounded-2xl p-4 ${error?'bg-red-50 text-red-700':'bg-emerald-50 text-emerald-800'}`}>{error||notice}</div>}

    <section className="grid gap-6 lg:grid-cols-2">
      <form onSubmit={createBureau} className="rounded-3xl bg-white p-6 shadow-sm"><p className="text-xs font-bold uppercase tracking-wider text-blue-700">Étape 1</p><h2 className="mt-1 text-2xl font-black">Ajouter un bureau local</h2><p className="mt-2 text-sm text-slate-500">Un bureau peut être créé sans observateur, puis affecté ensuite à un seul observateur actif.</p><div className="mt-5 grid gap-3"><input required value={bureauForm.code} onChange={e=>setBureauForm(v=>({...v,code:e.target.value}))} className="h-12 rounded-xl border px-4" placeholder="Code bureau (BL-001)"/><input required value={bureauForm.name} onChange={e=>setBureauForm(v=>({...v,name:e.target.value}))} className="h-12 rounded-xl border px-4" placeholder="Nom du bureau"/><input value={bureauForm.address} onChange={e=>setBureauForm(v=>({...v,address:e.target.value}))} className="h-12 rounded-xl border px-4" placeholder="Adresse (optionnel)"/><button disabled={busy} className="h-12 rounded-xl bg-slate-950 font-bold text-white disabled:opacity-50">AJOUTER LE BUREAU</button></div></form>

      <form onSubmit={createObserver} className="rounded-3xl bg-white p-6 shadow-sm"><p className="text-xs font-bold uppercase tracking-wider text-emerald-700">Étape 2</p><h2 className="mt-1 text-2xl font-black">Créer & affecter un observateur</h2><p className="mt-2 text-sm text-slate-500">Le choix ne propose que les bureaux actifs sans observateur.</p><div className="mt-5 grid gap-3 sm:grid-cols-2"><input required value={userForm.fullName} onChange={e=>setUserForm(v=>({...v,fullName:e.target.value}))} className="h-12 rounded-xl border px-4" placeholder="Nom complet"/><input required value={userForm.username} onChange={e=>setUserForm(v=>({...v,username:e.target.value}))} className="h-12 rounded-xl border px-4" placeholder="Username"/><input required minLength={8} type="password" value={userForm.password} onChange={e=>setUserForm(v=>({...v,password:e.target.value}))} className="h-12 rounded-xl border px-4" placeholder="Mot de passe temporaire"/><select required value={userForm.localBureauId} onChange={e=>setUserForm(v=>({...v,localBureauId:e.target.value}))} className="h-12 rounded-xl border px-4"><option value="">Bureau local…</option>{freeBureaux.map(b=><option key={b.id} value={b.id}>{b.code} — {b.name}</option>)}</select><input value={userForm.phone} onChange={e=>setUserForm(v=>({...v,phone:e.target.value}))} className="h-12 rounded-xl border px-4" placeholder="Téléphone (optionnel)"/><input type="email" value={userForm.email} onChange={e=>setUserForm(v=>({...v,email:e.target.value}))} className="h-12 rounded-xl border px-4" placeholder="Email contact (optionnel)"/><button disabled={busy||!freeBureaux.length} className="h-12 rounded-xl bg-emerald-700 font-bold text-white disabled:opacity-50 sm:col-span-2">CRÉER ET AFFECTER L’OBSERVATEUR</button></div>{!freeBureaux.length&&<p className="mt-3 text-xs text-amber-700">Aucun bureau actif libre. Ajoutez un nouveau bureau ou désactivez/réaffectez un observateur.</p>}</form>
    </section>

    <section className="rounded-3xl bg-white p-6 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-2xl font-black">Bureaux locaux</h2><p className="text-sm text-slate-500">{bureaux.length} bureau(x) enregistré(s).</p></div></div><div className="mt-4 overflow-auto rounded-2xl border"><table className="w-full min-w-[760px] text-sm"><thead className="bg-slate-100"><tr><th className="p-3 text-left">Code</th><th className="p-3 text-left">Bureau</th><th className="p-3 text-left">Observateur affecté</th><th className="p-3 text-left">État</th><th className="p-3"></th></tr></thead><tbody>{bureaux.map(b=><tr key={b.id} className="border-t"><td className="p-3 font-bold">{b.code}</td><td className="p-3">{b.name}<div className="text-xs text-slate-500">{b.address||'—'}</div></td><td className="p-3">{b.observer?<><b>{b.observer.full_name}</b><div className="text-xs text-slate-500">@{b.observer.username}</div></>:<span className="font-semibold text-amber-700">Non affecté</span>}</td><td className="p-3">{b.active?'Actif':'Inactif'}</td><td className="p-3 text-right"><button onClick={()=>toggleBureau(b)} className="rounded-lg border px-3 py-2 text-xs font-semibold">{b.active?'Désactiver':'Activer'}</button></td></tr>)}</tbody></table></div></section>

    <section className="rounded-3xl bg-white p-6 shadow-sm"><h2 className="text-2xl font-black">Utilisateurs</h2><div className="mt-4 overflow-auto rounded-2xl border"><table className="w-full min-w-[900px] text-sm"><thead className="bg-slate-100"><tr><th className="p-3 text-left">Username</th><th className="p-3 text-left">Nom</th><th className="p-3 text-left">Rôle</th><th className="p-3 text-left">Bureau</th><th className="p-3 text-left">État</th><th className="p-3 text-left">Actions</th></tr></thead><tbody>{users.map(u=>{const b=bureaux.find(x=>x.id===u.local_bureau_id);return <tr key={u.id} className="border-t"><td className="p-3 font-mono font-bold">{u.username}</td><td className="p-3">{u.full_name}</td><td className="p-3">{u.role}</td><td className="p-3">{b?`${b.code} — ${b.name}`:'—'}</td><td className="p-3">{u.active?'Actif':'Inactif'}</td><td className="p-3"><div className="flex gap-2"><button onClick={()=>resetPassword(u)} className="rounded-lg border px-3 py-2 text-xs font-semibold">Reset MDP</button>{u.id!==me.user.id&&<button onClick={()=>toggleUser(u)} className="rounded-lg border px-3 py-2 text-xs font-semibold">{u.active?'Désactiver':'Activer'}</button>}</div></td></tr>})}</tbody></table></div></section>

    <section className="rounded-3xl bg-white p-6 shadow-sm"><h2 className="text-2xl font-black">Import massif CSV / XLSX</h2><p className="mt-2 text-sm text-slate-600">Chaque ligne crée le bureau s’il n’existe pas puis crée son observateur. Si un bureau possède déjà un observateur actif, la ligne est refusée.</p><div className="mt-5 flex flex-wrap gap-3"><button onClick={template} className="rounded-xl border border-slate-300 px-4 py-3 font-semibold">Télécharger le modèle CSV</button><label className="cursor-pointer rounded-xl bg-blue-700 px-4 py-3 font-bold text-white">Choisir CSV / XLSX<input type="file" accept=".csv,.xlsx" onChange={fileChanged} className="hidden"/></label></div>{rows.length>0&&<><div className="mt-5 rounded-2xl bg-slate-100 p-4"><b>{rows.length}</b> ligne(s) valides détectées.</div><button disabled={busy} onClick={submitImport} className="mt-4 rounded-xl bg-slate-950 px-5 py-3 font-bold text-white disabled:opacity-50">{busy?'IMPORT EN COURS…':'IMPORTER LES BUREAUX ET OBSERVATEURS'}</button></>}{results.length>0&&<div className="mt-5 overflow-auto rounded-2xl border"><table className="w-full min-w-[760px] text-sm"><thead className="bg-slate-100"><tr><th className="p-3 text-left">Bureau</th><th className="p-3 text-left">Username</th><th className="p-3 text-left">Observateur</th><th className="p-3 text-left">Statut</th><th className="p-3 text-left">Message</th></tr></thead><tbody>{results.map((r,i)=><tr key={i} className="border-t"><td className="p-3">{r.bureauCode}</td><td className="p-3 font-mono">{r.username}</td><td className="p-3">{r.observerName}</td><td className="p-3">{r.status}</td><td className="p-3 text-slate-500">{r.message??'—'}</td></tr>)}</tbody></table></div>}</section>
  </main></div>;
}
