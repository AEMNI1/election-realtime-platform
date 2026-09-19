'use client';
import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { setAccessToken, getAccessToken } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import type { MeResponse } from '@/lib/types';

type LoginResponse = { accessToken: string; expiresAt: string; user: MeResponse['user'] };

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!getAccessToken()) return;
    apiFetch<MeResponse>('/api/me').then(me => {
      router.replace(me.user.must_change_password ? '/change-password' : (me.user.role === 'OBSERVER' ? '/observer' : '/dashboard/participation'));
    }).catch(() => undefined);
  }, [router]);

  async function submit(e: FormEvent) {
    e.preventDefault(); setLoading(true); setError('');
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.message ?? 'Username ou mot de passe incorrect.');
      const data = payload as LoginResponse;
      setAccessToken(data.accessToken, data.expiresAt);
      router.replace(data.user.must_change_password ? '/change-password' : (data.user.role === 'OBSERVER' ? '/observer' : '/dashboard/participation'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connexion impossible.');
      setLoading(false);
    }
  }

  return <main className="grid min-h-screen place-items-center bg-slate-100 p-4">
    <form onSubmit={submit} className="w-full max-w-md rounded-3xl bg-white p-7 shadow-xl">
      <div className="mb-7">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-700">Suivi électoral temps réel</p>
        <h1 className="mt-2 text-2xl font-black">Connexion</h1>
        <p className="mt-2 text-sm text-slate-500">Accès observateur ou bureau régional.</p>
      </div>
      <label className="text-sm font-semibold">Username</label>
      <input autoComplete="username" required value={username} onChange={e => setUsername(e.target.value)} className="mt-2 h-12 w-full rounded-xl border border-slate-300 px-4 outline-none focus:border-blue-600" placeholder="observer001" />
      <label className="mt-4 block text-sm font-semibold">Mot de passe</label>
      <input autoComplete="current-password" type="password" required value={password} onChange={e => setPassword(e.target.value)} className="mt-2 h-12 w-full rounded-xl border border-slate-300 px-4 outline-none focus:border-blue-600" />
      {error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <button disabled={loading} className="mt-6 w-full rounded-xl bg-blue-700 px-4 py-3 font-bold text-white disabled:opacity-50">{loading ? 'Connexion…' : 'SE CONNECTER'}</button>
      <p className="mt-5 text-center text-xs text-slate-400">Aucune inscription publique. Identifiants créés par le bureau régional.</p>
    </form>
  </main>;
}
