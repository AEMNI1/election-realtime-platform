'use client';
import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { clearAccessToken } from '@/lib/auth';
import type { MeResponse } from '@/lib/types';

export default function ChangePasswordPage(){
  const router=useRouter(); const [currentPassword,setCurrentPassword]=useState(''); const [newPassword,setNewPassword]=useState(''); const [confirm,setConfirm]=useState(''); const [error,setError]=useState(''); const [busy,setBusy]=useState(false);
  useEffect(()=>{apiFetch<MeResponse>('/api/me').catch(()=>router.replace('/login'))},[router]);
  async function submit(e:FormEvent){e.preventDefault();setError('');if(newPassword!==confirm){setError('La confirmation ne correspond pas.');return}setBusy(true);try{await apiFetch('/api/auth/change-password',{method:'POST',body:JSON.stringify({currentPassword,newPassword})});clearAccessToken();router.replace('/login')}catch(err){setError(err instanceof Error?err.message:'Erreur')}finally{setBusy(false)}}
  return <main className="grid min-h-screen place-items-center bg-slate-100 p-4"><form onSubmit={submit} className="w-full max-w-md rounded-3xl bg-white p-7 shadow-xl"><p className="text-xs font-bold uppercase tracking-wider text-blue-700">Sécurité du compte</p><h1 className="mt-2 text-2xl font-black">Changer le mot de passe</h1><p className="mt-2 text-sm text-slate-500">Le mot de passe initial fourni par l’administration doit être remplacé.</p><label className="mt-5 block text-sm font-semibold">Mot de passe actuel</label><input type="password" required minLength={8} value={currentPassword} onChange={e=>setCurrentPassword(e.target.value)} className="mt-2 h-12 w-full rounded-xl border px-4"/><label className="mt-4 block text-sm font-semibold">Nouveau mot de passe</label><input type="password" required minLength={8} value={newPassword} onChange={e=>setNewPassword(e.target.value)} className="mt-2 h-12 w-full rounded-xl border px-4"/><label className="mt-4 block text-sm font-semibold">Confirmer</label><input type="password" required minLength={8} value={confirm} onChange={e=>setConfirm(e.target.value)} className="mt-2 h-12 w-full rounded-xl border px-4"/>{error&&<p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}<button disabled={busy} className="mt-6 w-full rounded-xl bg-slate-950 px-4 py-3 font-bold text-white disabled:opacity-50">{busy?'ENREGISTREMENT…':'ENREGISTRER LE NOUVEAU MOT DE PASSE'}</button></form></main>
}
