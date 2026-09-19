import Link from 'next/link';
export default function Home() {
  return <main className="grid min-h-screen place-items-center bg-slate-100 p-5">
    <section className="w-full max-w-3xl rounded-3xl bg-white p-8 shadow-xl sm:p-12">
      <p className="text-xs font-bold uppercase tracking-[.2em] text-blue-700">Plateforme métier critique temps réel</p>
      <h1 className="mt-3 text-3xl font-black sm:text-5xl">Suivi électoral régional</h1>
      <p className="mt-4 max-w-2xl text-slate-600">Un observateur par bureau local, synchronisation temps réel avec le bureau régional, suivi de la participation et remontée des résultats du parti.</p>
      <div className="mt-8 flex flex-wrap gap-3"><Link href="/login" className="rounded-xl bg-blue-700 px-5 py-3 font-bold text-white">Se connecter</Link></div>
      <p className="mt-8 border-t pt-5 text-xs leading-5 text-slate-500">Aucune donnée personnelle concernant les électeurs n'est collectée. Les résultats affichés sont des données internes remontées par les observateurs et ne constituent pas des résultats officiels.</p>
    </section>
  </main>;
}
