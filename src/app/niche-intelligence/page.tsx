"use client";
import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";

interface Niche {
  id: string; slug: string; displayName: string;
  avgCompetitionScore: number; avgDomainAge: number; avgDR: number;
  parasiteSuccessRate: number; avgTimeToRank: number; avgCPC: number;
  estimatedRPM: number; monthlyRevenuePerSite: number;
  expiredDomainsAvailable: number; indexationRate: number;
  difficulty: string; opportunity: string; opportunityScore: number;
  topKeyword: string; topKeywords: {keyword:string;volume:number;cpc:number;difficulty:number}[];
  affiliatePrograms: {name:string;commission:string;cookie:string;network:string}[];
  realScannedCount?: number; realIndexedCount?: number; realAvgScore?: number; boughtCount?: number;
}

const DC: Record<string,string> = { EASY:"bg-green-500/20 text-green-400 border-green-500/30", MEDIUM:"bg-yellow-500/20 text-yellow-400 border-yellow-500/30", HARD:"bg-orange-500/20 text-orange-400 border-orange-500/30", "VERY HARD":"bg-red-500/20 text-red-400 border-red-500/30" };
const OC: Record<string,string> = { HOT:"bg-orange-500/20 text-orange-400 border-orange-500/30", GOOD:"bg-blue-500/20 text-blue-400 border-blue-500/30", MODERATE:"bg-gray-500/20 text-gray-400 border-gray-500/30", SATURATED:"bg-red-500/20 text-red-400 border-red-500/30" };
const OT: Record<string,number> = { EASY:55, MEDIUM:60, HARD:65, "VERY HARD":70 };
const TRENDS = ["↑","→","↑","→","🔥","↓","→","🔥","→","↓"];

function Badge({ label, cls }: { label: string; cls: string }) {
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${cls}`}>{label}</span>;
}

function Bar({ v, color = "bg-primary" }: { v: number; color?: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 rounded-full bg-muted overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${Math.min(100,v)}%` }} />
      </div>
      <span className="text-xs font-mono">{v}%</span>
    </div>
  );
}

function Ring({ score }: { score: number }) {
  const c = score >= 65 ? "#22c55e" : score >= 45 ? "#eab308" : "#ef4444";
  const r = 16, circ = 2*Math.PI*r, dash = (score/100)*circ;
  return (
    <svg width="40" height="40" viewBox="0 0 40 40">
      <circle cx="20" cy="20" r={r} fill="none" stroke="currentColor" strokeWidth="3" className="text-muted/40"/>
      <circle cx="20" cy="20" r={r} fill="none" stroke={c} strokeWidth="3" strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" transform="rotate(-90 20 20)"/>
      <text x="20" y="20" textAnchor="middle" dominantBaseline="central" fill={c} fontSize="9" fontWeight="bold">{score}</text>
    </svg>
  );
}

export default function NicheIntelligencePage() {
  const router = useRouter();
  const [niches, setNiches] = useState<Niche[]>([]);
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState<{totalScanned:number;totalIndexed:number;totalNiches:number}|null>(null);
  const [sortBy, setSortBy] = useState<keyof Niche>("opportunityScore");
  const [sortDir, setSortDir] = useState<"asc"|"desc">("desc");
  const [selected, setSelected] = useState<Niche|null>(null);
  const [tab, setTab] = useState<"table"|"cards"|"calculator">("table");
  const [domsPerDay, setDomsPerDay] = useState(5);
  const [threshold, setThreshold] = useState(65);

  useEffect(() => {
    fetch("/api/niche-intelligence").then(r=>r.json()).then(j=>{
      if (j.niches) setNiches(j.niches);
      if (j.meta) setMeta(j.meta);
    }).finally(()=>setLoading(false));
  }, []);

  const sorted = useMemo(() => [...niches].sort((a,b) => {
    const av = a[sortBy] as number, bv = b[sortBy] as number;
    return sortDir === "desc" ? bv-av : av-bv;
  }), [niches, sortBy, sortDir]);

  function toggleSort(col: keyof Niche) {
    if (sortBy === col) setSortDir(d => d === "desc" ? "asc" : "desc");
    else { setSortBy(col); setSortDir("desc"); }
  }

  const best = sorted[0];
  const highRPM = [...niches].sort((a,b)=>b.estimatedRPM-a.estimatedRPM)[0];
  const easiest = [...niches].sort((a,b)=>a.avgTimeToRank-b.avgTimeToRank)[0];
  const mostDoms = [...niches].sort((a,b)=>b.expiredDomainsAvailable-a.expiredDomainsAvailable)[0];

  // Calculator
  const calcN = selected ?? best;
  const monthly = domsPerDay * 30;
  const success = calcN ? calcN.parasiteSuccessRate/100 : 0.6;
  const ranked = Math.round(monthly * success);
  const traffic = ranked * 850;
  const revMin = Math.round(traffic * 0.012);
  const revMax = Math.round(traffic * 0.028);
  const roi6m = revMin > 0 ? Math.round(((revMin*6 - 10*monthly) / (10*monthly)) * 100) : 0;

  const COLS: [keyof Niche, string][] = [
    ["displayName","Niche"],["difficulty","Diff"],["opportunity","Signal"],
    ["parasiteSuccessRate","Success %"],["avgTimeToRank","Rank Days"],
    ["expiredDomainsAvailable","Domains"],["indexationRate","Index %"],
    ["estimatedRPM","RPM"],["monthlyRevenuePerSite","$/Month"],["opportunityScore","Score"],
  ];

  return (
    <div className="flex flex-col gap-6 pb-10">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">🧠 Niche Intelligence</h1>
          <p className="text-muted-foreground mt-1.5 text-sm">Research-backed metrics on competition, revenue, and success rates — enriched with real scan data.</p>
        </div>
        {meta && (
          <div className="flex gap-3 text-center">
            {[
              { label: "Niches", val: meta.totalNiches, c: "text-blue-400" },
              { label: "Scanned", val: meta.totalScanned, c: "text-green-400" },
              { label: "Indexed", val: meta.totalIndexed, c: "text-purple-400" },
            ].map(s => (
              <div key={s.label} className="rounded-xl border bg-card px-4 py-2.5 min-w-[70px]">
                <div className={`text-xl font-bold ${s.c}`}>{s.val}</div>
                <div className="text-[10px] text-muted-foreground">{s.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Hero cards */}
      {!loading && niches.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label:"Best Niche Right Now", n:best, sub:`${best?.parasiteSuccessRate}% success`, icon:"🔥", c:"text-orange-400", bg:"bg-orange-500/10 border-orange-500/20" },
            { label:"Highest RPM", n:highRPM, sub:`$${highRPM?.estimatedRPM}/RPM`, icon:"💰", c:"text-green-400", bg:"bg-green-500/10 border-green-500/20" },
            { label:"Easiest to Rank", n:easiest, sub:`${easiest?.avgTimeToRank}d avg`, icon:"⚡", c:"text-yellow-400", bg:"bg-yellow-500/10 border-yellow-500/20" },
            { label:"Most Domains", n:mostDoms, sub:`${mostDoms?.expiredDomainsAvailable.toLocaleString()} expired`, icon:"🌐", c:"text-blue-400", bg:"bg-blue-500/10 border-blue-500/20" },
          ].map(c => (
            <div key={c.label} onClick={() => { setSelected(c.n); setTab("calculator"); }} className={`rounded-xl border p-5 cursor-pointer hover:scale-[1.01] transition-transform ${c.bg}`}>
              <div className="text-xl mb-2">{c.icon}</div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">{c.label}</div>
              <div className={`text-base font-bold ${c.c}`}>{c.n?.displayName}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{c.sub}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {[{k:"table",l:`📊 Comparison Table (${niches.length})`},{k:"cards",l:"🃏 Niche Cards"},{k:"calculator",l:"💰 Revenue Calculator"}].map(t=>(
          <button key={t.k} onClick={()=>setTab(t.k as typeof tab)} className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab===t.k?"border-primary text-foreground":"border-transparent text-muted-foreground hover:text-foreground"}`}>{t.l}</button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center gap-4 p-16 text-muted-foreground">
          <div className="h-10 w-10 border-2 border-primary/30 border-t-primary rounded-full animate-spin"/>
          <div className="text-sm">Loading niche intelligence…</div>
        </div>
      )}

      {/* TABLE TAB */}
      {!loading && tab === "table" && (
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="px-5 py-3.5 border-b flex items-center justify-between">
            <h2 className="font-semibold">Niche Comparison</h2>
            <span className="text-xs text-muted-foreground">Click column header to sort · Click row to open detail</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  {COLS.map(([k,l]) => (
                    <th key={k} onClick={() => toggleSort(k)} className="px-4 py-3 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wide cursor-pointer hover:text-foreground whitespace-nowrap select-none">
                      {l}{sortBy===k?(sortDir==="desc"?" ↓":" ↑"):""}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Live DB</th>
                  <th className="px-4 py-3"/>
                </tr>
              </thead>
              <tbody>
                {sorted.map((n, i) => (
                  <tr key={n.slug} onClick={() => { setSelected(n); setTab("calculator"); }} className={`border-b hover:bg-muted/20 cursor-pointer transition-colors ${selected?.slug===n.slug?"bg-primary/5":""}`}>
                    <td className="px-4 py-3 font-medium whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{TRENDS[i%TRENDS.length]}</span>
                        {n.displayName}
                      </div>
                    </td>
                    <td className="px-4 py-3"><Badge label={n.difficulty} cls={DC[n.difficulty]??""}/></td>
                    <td className="px-4 py-3"><Badge label={n.opportunity} cls={OC[n.opportunity]??""}/></td>
                    <td className="px-4 py-3"><Bar v={n.parasiteSuccessRate} color={n.parasiteSuccessRate>=60?"bg-green-500":n.parasiteSuccessRate>=40?"bg-yellow-500":"bg-red-500"}/></td>
                    <td className="px-4 py-3"><span className={`font-mono font-bold text-sm ${n.avgTimeToRank<10?"text-green-400":n.avgTimeToRank<20?"text-yellow-400":"text-red-400"}`}>{n.avgTimeToRank}d</span></td>
                    <td className="px-4 py-3 font-mono text-blue-400">{n.expiredDomainsAvailable.toLocaleString()}</td>
                    <td className="px-4 py-3"><Bar v={n.indexationRate} color="bg-primary"/></td>
                    <td className="px-4 py-3 font-mono">${n.estimatedRPM}</td>
                    <td className="px-4 py-3 font-mono text-green-400">${n.monthlyRevenuePerSite}</td>
                    <td className="px-4 py-3"><Ring score={n.opportunityScore}/></td>
                    <td className="px-4 py-3">
                      {(n.realScannedCount??0) > 0 ? (
                        <div className="text-[10px]">
                          <div className="text-green-400 font-bold">{n.realScannedCount} scanned</div>
                          <div className="text-muted-foreground">{n.realIndexedCount} indexed</div>
                        </div>
                      ) : <span className="text-[10px] text-muted-foreground/40">no data</span>}
                    </td>
                    <td className="px-4 py-3" onClick={e=>e.stopPropagation()}>
                      <button onClick={()=>router.push(`/hunt?niche=${n.slug}&threshold=${OT[n.difficulty]}&source=intelligence`)} className="px-3 py-1.5 text-xs rounded-lg bg-primary/15 text-primary hover:bg-primary/25 font-bold">Hunt →</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CARDS TAB */}
      {!loading && tab === "cards" && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {sorted.map((n, i) => (
            <div key={n.slug} className={`rounded-xl border bg-card p-5 space-y-4 cursor-pointer hover:border-primary/40 transition-all hover:shadow-lg ${selected?.slug===n.slug?"border-primary/40 shadow-lg":""}`} onClick={()=>setSelected(selected?.slug===n.slug?null:n)}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold">{n.displayName}</span>
                    <Badge label={n.opportunity} cls={OC[n.opportunity]??""}/>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge label={n.difficulty} cls={DC[n.difficulty]??""}/>
                    <span className="text-[10px] text-muted-foreground">{TRENDS[i%TRENDS.length]} trend</span>
                  </div>
                </div>
                <Ring score={n.opportunityScore}/>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  { label:"Success", val:`${n.parasiteSuccessRate}%`, c:n.parasiteSuccessRate>=60?"text-green-400":"text-yellow-400" },
                  { label:"RPM", val:`$${n.estimatedRPM}`, c:"text-foreground" },
                  { label:"$/mo", val:`$${n.monthlyRevenuePerSite}`, c:"text-green-400" },
                ].map(s=>(
                  <div key={s.label} className="bg-muted/30 rounded-lg p-2">
                    <div className={`text-sm font-bold ${s.c}`}>{s.val}</div>
                    <div className="text-[10px] text-muted-foreground">{s.label}</div>
                  </div>
                ))}
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-muted-foreground">Success Rate</span>
                  <span className="font-mono">{n.parasiteSuccessRate}%</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${n.parasiteSuccessRate>=60?"bg-green-500":n.parasiteSuccessRate>=40?"bg-yellow-500":"bg-red-500"}`} style={{width:`${n.parasiteSuccessRate}%`}}/>
                </div>
              </div>
              {(n.realScannedCount??0) > 0 && (
                <div className="bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2 text-[11px]">
                  <span className="text-green-400 font-semibold">📊 Live: </span>
                  <span className="text-muted-foreground">{n.realScannedCount} domains scanned · {n.realIndexedCount} indexed · {n.boughtCount} bought</span>
                </div>
              )}
              <div className="flex gap-2">
                <button onClick={e=>{e.stopPropagation();router.push(`/hunt?niche=${n.slug}&threshold=${OT[n.difficulty]}&source=intelligence`);}} className="flex-1 h-8 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90">🎯 Hunt</button>
                <button onClick={e=>{e.stopPropagation();router.push(`/spy`);}} className="h-8 px-3 rounded-lg border border-border text-xs hover:bg-muted/50">🕵️ Spy</button>
              </div>

              {selected?.slug === n.slug && (
                <div className="space-y-3 border-t border-border pt-3">
                  <div className="text-xs font-semibold">🔑 Top Keywords</div>
                  {(n.topKeywords??[]).slice(0,4).map(kw=>(
                    <div key={kw.keyword} className="flex items-center justify-between text-xs bg-muted/20 rounded px-3 py-1.5">
                      <span className="font-medium">{kw.keyword}</span>
                      <div className="flex items-center gap-3 text-muted-foreground">
                        <span>{(kw.volume/1000).toFixed(0)}k/mo</span>
                        <span className="text-green-400">${kw.cpc.toFixed(2)} CPC</span>
                      </div>
                    </div>
                  ))}
                  {(n.affiliatePrograms??[]).length>0 && (
                    <>
                      <div className="text-xs font-semibold">💸 Affiliates</div>
                      {n.affiliatePrograms.slice(0,2).map(ap=>(
                        <div key={ap.name} className="flex items-center justify-between text-xs bg-muted/20 rounded px-3 py-1.5">
                          <span>{ap.name}</span>
                          <span className="text-green-400 font-semibold">{ap.commission}</span>
                        </div>
                      ))}
                    </>
                  )}
                  <div className="text-xs bg-primary/5 border border-primary/20 rounded-lg px-3 py-2 text-muted-foreground leading-relaxed">
                    🎯 Target domains age &gt; {n.avgDomainAge?.toFixed(1)}y with DR &gt; {Math.round((n.avgDR??30)*0.7)}. Avg time to rank: <strong className="text-foreground">{n.avgTimeToRank}d</strong>. Expected: <strong className="text-green-400">${n.monthlyRevenuePerSite}/mo</strong>.
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* CALCULATOR TAB */}
      {!loading && tab === "calculator" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-xl border bg-card p-6 space-y-5">
            <h2 className="font-semibold">💰 Revenue Calculator</h2>
            {calcN && (
              <div className="flex items-center gap-3 bg-primary/5 border border-primary/20 rounded-xl px-4 py-3">
                <Ring score={calcN.opportunityScore}/>
                <div>
                  <div className="font-bold">{calcN.displayName}</div>
                  <div className="text-xs text-muted-foreground">{calcN.parasiteSuccessRate}% success · ${calcN.monthlyRevenuePerSite}/mo avg</div>
                </div>
              </div>
            )}
            {[
              { label:`Domains per day: ${domsPerDay}`, min:1, max:20, val:domsPerDay, set:setDomsPerDay },
              { label:`Score threshold: ${threshold}`, min:50, max:80, val:threshold, set:setThreshold },
            ].map(s=>(
              <div key={s.label} className="space-y-2">
                <div className="flex justify-between text-sm">
                  <label className="font-medium">{s.label}</label>
                </div>
                <input type="range" min={s.min} max={s.max} value={s.val} onChange={e=>s.set(Number(e.target.value))} className="w-full accent-primary h-2 rounded-full"/>
              </div>
            ))}
            <div className="text-xs text-muted-foreground bg-muted/20 rounded-lg p-3">
              Select a niche from the <button onClick={()=>setTab("table")} className="text-primary underline">Comparison Table</button> or <button onClick={()=>setTab("cards")} className="text-primary underline">Cards</button> to use their real success rate in calculations.
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 content-start">
            {[
              { label:"Domains/Month", val:monthly.toLocaleString(), c:"text-foreground" },
              { label:"Expected Ranked", val:ranked.toLocaleString(), c:"text-blue-400" },
              { label:"Monthly Traffic", val:`${traffic.toLocaleString()} visits`, c:"text-foreground" },
              { label:"Revenue Range", val:`$${revMin.toLocaleString()}–$${revMax.toLocaleString()}`, c:"text-green-400" },
              { label:"Success Rate Used", val:`${calcN?.parasiteSuccessRate??60}%`, c:"text-foreground" },
              { label:"6-Month ROI", val:`${roi6m}%`, c:roi6m>0?"text-green-400":"text-red-400" },
            ].map(m=>(
              <div key={m.label} className="rounded-xl border bg-card p-4">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{m.label}</div>
                <div className={`text-xl font-bold mt-1 ${m.c}`}>{m.val}</div>
              </div>
            ))}
            {calcN && (
              <div className="col-span-2">
                <button onClick={()=>router.push(`/hunt?niche=${calcN.slug}&threshold=${OT[calcN.difficulty]}&source=intelligence`)} className="w-full h-12 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold text-base transition-colors">
                  🎯 Hunt {calcN.displayName} Now →
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
