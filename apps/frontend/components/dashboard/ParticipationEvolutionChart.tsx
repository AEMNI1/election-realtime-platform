'use client';

type Point={at:string;total:number};
export function ParticipationEvolutionChart({points}:{points:Point[]}){
  if(!points.length) return <div className="rounded-3xl bg-white p-6 shadow-sm"><h2 className="text-lg font-black">Évolution de la participation</h2><p className="mt-5 text-sm text-slate-500">Aucun événement enregistré pour le moment.</p></div>;
  const reduced=points.length<=160?points:points.filter((_,i)=>i%Math.ceil(points.length/160)===0||i===points.length-1);
  const max=Math.max(...reduced.map(p=>p.total),1); const w=900,h=260,pad=42;
  const coords=reduced.map((p,i)=>({x:pad+(i/(Math.max(reduced.length-1,1)))*(w-pad*2),y:h-pad-(p.total/max)*(h-pad*2),...p}));
  const path=coords.map((p,i)=>`${i?'L':'M'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  return <div className="rounded-3xl bg-white p-5 shadow-sm"><div className="flex items-end justify-between gap-3"><div><h2 className="text-lg font-black">Évolution de la participation</h2><p className="text-xs text-slate-500">Cumul régional reconstruit à partir des événements atomiques</p></div><p className="text-2xl font-black">{points[points.length-1].total.toLocaleString('fr-MA')}</p></div><div className="mt-4 overflow-x-auto"><svg viewBox={`0 0 ${w} ${h}`} className="min-w-[700px] w-full"><line x1={pad} y1={h-pad} x2={w-pad} y2={h-pad} stroke="#cbd5e1"/><line x1={pad} y1={pad} x2={pad} y2={h-pad} stroke="#cbd5e1"/><path d={path} fill="none" stroke="#1d4ed8" strokeWidth="4" strokeLinejoin="round" strokeLinecap="round"/>{coords.filter((_,i)=>i%Math.ceil(coords.length/8)===0||i===coords.length-1).map((p,i)=><g key={i}><circle cx={p.x} cy={p.y} r="4" fill="#1d4ed8"><title>{new Date(p.at).toLocaleTimeString('fr-MA')} — {p.total}</title></circle></g>)}</svg></div><div className="flex justify-between text-xs text-slate-400"><span>{new Date(points[0].at).toLocaleTimeString('fr-MA')}</span><span>{new Date(points[points.length-1].at).toLocaleTimeString('fr-MA')}</span></div></div>;
}
