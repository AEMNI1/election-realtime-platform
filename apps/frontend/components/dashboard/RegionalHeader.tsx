'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { logoutApi } from '@/lib/api';
import type { ElectionMode } from '@/lib/types';
import { StatusPill } from '../StatusPill';

export function RegionalHeader({ electionMode, userName }: { electionMode?: ElectionMode; userName?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const links = [
    ['/dashboard/participation', 'Participation'],
    ['/dashboard/results', 'Résultats'],
    ['/dashboard/control', 'Centre de contrôle'],
    ['/dashboard/admin', 'Administration']
  ];
  return <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
    <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><p className="text-xs font-bold uppercase tracking-wider text-slate-500">Bureau régional</p><h1 className="text-lg font-black">Monitoring électoral temps réel</h1></div>
        <div className="flex items-center gap-3">{electionMode && <StatusPill tone={electionMode === 'VOTING' ? 'blue' : electionMode === 'COUNTING' ? 'orange' : electionMode === 'COMPLETED' ? 'green' : 'slate'}>{electionMode}</StatusPill>}<span className="hidden text-sm text-slate-500 sm:inline">{userName}</span><button onClick={async()=>{await logoutApi();router.replace('/login')}} className="rounded-lg border px-3 py-2 text-sm font-semibold">Déconnexion</button></div>
      </div>
      <nav className="mt-3 flex gap-2 overflow-x-auto">
        {links.map(([href,label]) => <Link key={href} href={href} className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold ${pathname===href?'bg-slate-950 text-white':'bg-slate-100 text-slate-700'}`}>{label}</Link>)}
      </nav>
    </div>
  </header>;
}
