'use client';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, logoutApi } from '@/lib/api';
import { subscribeRealtime } from '@/lib/realtime';
import type { MeResponse } from '@/lib/types';
import { ObserverCounter } from './ObserverCounter';
import { ObserverResultForm } from './ObserverResultForm';
import { StatusPill } from './StatusPill';

export function ObserverWorkspace() {
  const router = useRouter();
  const [data, setData] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const me = await apiFetch<MeResponse>('/api/me');
      if (me.user.must_change_password) { router.replace('/change-password'); return; }
      if (me.user.role !== 'OBSERVER') { router.replace('/dashboard/participation'); return; }
      setData(me); setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Impossible de charger le profil');
      router.replace('/login');
    } finally { setLoading(false); }
  }, [router]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!data) return;
    return subscribeRealtime(topic => {
      if (topic === 'participation' || topic === 'results' || topic === 'settings' || topic === 'admin') load();
    });
  }, [data?.user.id, load]);

  useEffect(() => {
    if (!data?.bureau?.id) return;
    async function heartbeat(status: 'CONNECTED'|'BACKGROUND' = 'CONNECTED') {
      try { await apiFetch('/api/presence/heartbeat', { method: 'POST', body: JSON.stringify({ connectionStatus: status }) }); } catch { /* next cycle retries */ }
    }
    heartbeat();
    const id = window.setInterval(() => heartbeat(document.hidden ? 'BACKGROUND' : 'CONNECTED'), 30_000);
    const visibility = () => heartbeat(document.hidden ? 'BACKGROUND' : 'CONNECTED');
    document.addEventListener('visibilitychange', visibility);
    return () => { window.clearInterval(id); document.removeEventListener('visibilitychange', visibility); };
  }, [data?.bureau?.id]);

  async function logout() { await logoutApi(); router.replace('/login'); }

  if (loading) return <main className="grid min-h-screen place-items-center"><p>Chargement…</p></main>;
  if (error || !data?.bureau) return <main className="mx-auto max-w-lg p-8"><div className="rounded-2xl bg-red-50 p-5 text-red-800">{error || 'Bureau local non configuré.'}</div></main>;

  return <main className="min-h-screen bg-slate-50 pb-12">
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-8">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Bureau local</p>
          <h1 className="text-lg font-black sm:text-xl">{data.bureau.code} — {data.bureau.name}</h1>
          <p className="text-sm text-slate-500">Observateur : {data.user.full_name} · @{data.user.username}</p>
        </div>
        <div className="flex items-center gap-3">
          <StatusPill tone={data.electionMode === 'VOTING' ? 'blue' : data.electionMode === 'COUNTING' ? 'orange' : data.electionMode === 'COMPLETED' ? 'green' : 'slate'}>{data.electionMode}</StatusPill>
          <button onClick={logout} className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold">Déconnexion</button>
        </div>
      </div>
    </header>

    <div className="mx-auto grid max-w-5xl gap-6 px-4 py-6 sm:px-8 lg:grid-cols-2">
      <ObserverCounter
        localBureauId={data.bureau.id}
        serverCount={data.participation?.currentCount ?? 0}
        updatedAt={data.participation?.updatedAt}
        electionMode={data.electionMode}
        onCountChange={currentCount => setData(prev => prev ? { ...prev, participation: { currentCount, updatedAt: new Date().toISOString() } } : prev)}
      />
      <ObserverResultForm
        localBureauId={data.bureau.id}
        bureauName={`${data.bureau.code} — ${data.bureau.name}`}
        electionMode={data.electionMode}
        initialResult={data.result}
        onResultChange={load}
      />
    </div>

    <div className="mx-auto max-w-5xl px-4 sm:px-8">
      <p className="rounded-2xl bg-slate-100 p-4 text-xs leading-5 text-slate-600">Données internes remontées par les observateurs du parti. Elles ne constituent pas une publication officielle des résultats électoraux.</p>
    </div>
  </main>;
}
