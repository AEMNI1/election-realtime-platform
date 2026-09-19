'use client';
import type { ResultCategory, ResultValues } from '@/lib/types';

export function ResultCategoryCircles({ categories, totals }: { categories: ResultCategory[]; totals: ResultValues }) {
  return <section className="rounded-3xl bg-slate-950 p-5 shadow-xl">
    <div className="mb-5">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Résultats régionaux temps réel</p>
      <h2 className="mt-1 text-2xl font-black text-white">Voix par parti / catégorie suivie</h2>
      <p className="mt-2 text-sm text-slate-400">Aucun total global n’est affiché : d’autres partis peuvent exister hors du périmètre de suivi.</p>
    </div>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {categories.map(category => <div key={category.code} className="flex min-h-52 items-center justify-center">
        <div className={`grid h-48 w-48 place-items-center rounded-full border-4 text-center shadow-2xl ${category.code === 'REJECTED' ? 'border-amber-400 bg-amber-950/40' : 'border-emerald-400 bg-emerald-950/30'}`}>
          <div className="px-4">
            <p className="text-lg font-black text-white">{category.code === 'REJECTED' ? 'REJETÉS' : category.code}</p>
            <p className="mt-2 text-4xl font-black tabular-nums text-white">{Number(totals[category.code] ?? 0).toLocaleString('fr-MA')}</p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-300">voix</p>
          </div>
        </div>
      </div>)}
    </div>
  </section>;
}
