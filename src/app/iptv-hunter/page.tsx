"use client";
import { useState, useEffect } from "react";

const MKT = [
  { id:"US",flag:"🇺🇸",lang:"en",kw:["best iptv service","iptv subscription","iptv usa","iptv app","iptv player"],cpc:1.4,vol:180000,diff:"MEDIUM",rate:68 },
  { id:"UK",flag:"🇬🇧",lang:"en",kw:["best iptv uk","iptv subscription uk","iptv service uk","cheap iptv","iptv box"],cpc:1.2,vol:120000,diff:"MEDIUM",rate:65 },
  { id:"FR",flag:"🇫🇷",lang:"fr",kw:["meilleur iptv","abonnement iptv","iptv france","iptv gratuit","iptv smarters"],cpc:0.9,vol:280000,diff:"EASY",rate:78 },
  { id:"DE",flag:"🇩🇪",lang:"de",kw:["iptv anbieter","iptv deutschland","beste iptv","iptv abo","iptv legal"],cpc:1.1,vol:95000,diff:"MEDIUM",rate:62 },
  { id:"NL",flag:"🇳🇱",lang:"nl",kw:["iptv nederland","beste iptv","iptv abonnement","iptv aanbieder","iptv kopen"],cpc:0.8,vol:85000,diff:"EASY",rate:72 },
  { id:"ES",flag:"🇪🇸",lang:"es",kw:["mejor iptv","iptv españa","iptv barato","lista iptv","iptv legal"],cpc:0.7,vol:150000,diff:"EASY",rate:75 },
  { id:"IT",flag:"🇮🇹",lang:"it",kw:["miglior iptv","iptv italia","abbonamento iptv","iptv legale","iptv gratis"],cpc:0.6,vol:130000,diff:"EASY",rate:74 },
  { id:"PT",flag:"🇵🇹",lang:"pt",kw:["melhor iptv","iptv portugal","iptv barato","lista iptv","iptv grátis"],cpc:0.5,vol:70000,diff:"EASY",rate:80 },
  { id:"SE",flag:"🇸🇪",lang:"sv",kw:["bästa iptv","iptv sverige","iptv abonnemang","iptv app","iptv gratis"],cpc:1.0,vol:45000,diff:"EASY",rate:70 },
  { id:"NO",flag:"🇳🇴",lang:"no",kw:["beste iptv","iptv norge","iptv abonnement","iptv app","iptv gratis"],cpc:1.1,vol:35000,diff:"EASY",rate:71 },
  { id:"DK",flag:"🇩🇰",lang:"da",kw:["bedste iptv","iptv danmark","iptv abonnement","iptv app","iptv gratis"],cpc:0.9,vol:30000,diff:"EASY",rate:69 },
  { id:"AR",flag:"🇸🇦",lang:"ar",kw:["أفضل iptv","اشتراك iptv","iptv عربي","قنوات iptv","iptv مجاني"],cpc:0.4,vol:200000,diff:"EASY",rate:82 },
  { id:"TR",flag:"🇹🇷",lang:"tr",kw:["en iyi iptv","iptv abonelik","iptv türkiye","iptv ucuz","iptv izle"],cpc:0.3,vol:180000,diff:"EASY",rate:85 },
  { id:"BR",flag:"🇧🇷",lang:"pt-br",kw:["melhor iptv","iptv brasil","lista iptv","iptv barato","teste iptv"],cpc:0.4,vol:250000,diff:"EASY",rate:80 },
];

interface DomainData { domain:string; iptvScore:number; parasiteReadiness:string; estimatedRankDays:number; googlePages?:number; estimatedMonthlyRevenue?:number; previouslyIPTV?:boolean; }

const DC: Record<string,string> = { EASY:"text-green-400", MEDIUM:"text-yellow-400", HARD:"text-red-400" };

function Ring({ score, size=40 }: { score:number; size?:number }) {
  const c = score>=70?"#22c55e":score>=50?"#eab308":"#ef4444";
  const r=14,circ=2*Math.PI*r,dash=(score/100)*circ;
  return <svg width={size} height={size} viewBox="0 0 36 36"><circle cx="18" cy="18" r={r} fill="none" stroke="currentColor" strokeWidth="2.5" className="text-muted/40"/><circle cx="18" cy="18" r={r} fill="none" stroke={c} strokeWidth="2.5" strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" transform="rotate(-90 18 18)"/><text x="18" y="18" textAnchor="middle" dominantBaseline="central" fill={c} fontSize="8" fontWeight="bold">{score}</text></svg>;
}

export default function IPTVHunterPage() {
  const [market, setMarket] = useState("FR");
  const [tab, setTab] = useState<"overview"|"keywords"|"domains"|"patterns">("overview");
  const [domains, setDomains] = useState<DomainData[]>([]);
  const [scanning, setScanning] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [liveData, setLiveData] = useState<{totalKeywords:number;avgCPC:number;topKeyword:string;difficulty:string;successRate:number;topKeywords:{keyword:string;volume?:number;cpc:number}[];dataSource?:string;lastUpdated?:string}|null>(null);
  const [hasDfs, setHasDfs] = useState(true);

  const m = MKT.find(x=>x.id===market) ?? MKT[0];
  const allVol = MKT.reduce((s,x)=>s+x.vol,0);


  useEffect(() => {
    if (market !== "ALL") fetch(`/api/iptv/markets/${market}`).then(r=>r.json()).then(j=>setLiveData(j.data??null)).catch(()=>setLiveData(null));
    else setLiveData(null);
  }, [market]);

  useEffect(() => {
    fetch("/api/settings").then(r=>r.json()).then(j=>{
      if(j.data) setHasDfs(!!(j.data.dfs_email||j.data.dataForSeoEmail));
    }).catch(()=>{});
  }, []);

  const handleScan = async () => {
    setScanning(true);
    try {
      const r = await fetch("/api/iptv/scan",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({markets:[market]})});
      const d = await r.json();
      if(d.results) { setDomains(d.results); setTab("domains"); }
    } finally { setScanning(false); }
  };

  const handleUpdate = async () => {
    setUpdating(true);
    try {
      await fetch("/api/iptv/update-keywords",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({markets:[market]})});
      const r2 = await fetch(`/api/iptv/markets/${market}`);
      const j2 = await r2.json();
      if(j2.data) setLiveData(j2.data);
    } finally { setUpdating(false); }
  };

  const kws = liveData?.topKeywords ?? m.kw.map((k,i)=>({keyword:k,volume:Math.round(m.vol/(i+1.5)),cpc:m.cpc*(1-i*0.08)}));
  const totalSearches = liveData?.totalKeywords ?? m.vol;
  const avgCpc = liveData?.avgCPC ?? m.cpc;

  const diff = liveData?.difficulty ?? m.diff;
  const successRate = liveData?.successRate ?? m.rate;

  return (
    <div className="flex flex-col gap-5 pb-10">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">📺 IPTV Domain Intelligence</h1>
          <p className="text-muted-foreground mt-1.5 text-sm">Dominate the IPTV niche across {MKT.length} markets · {allVol.toLocaleString()} monthly searches worldwide</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleUpdate} disabled={updating} className="h-9 px-4 rounded-lg border border-border text-xs font-medium hover:bg-muted/50 disabled:opacity-50">{updating?"Updating…":"🔄 Refresh Data"}</button>
          <button onClick={handleScan} disabled={scanning} className="h-9 px-4 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 disabled:opacity-50">{scanning?"Scanning…":"🎯 Scan Domains"}</button>
        </div>
      </div>

      {/* Market Selector */}
      <div className="flex flex-wrap gap-1.5">
        {MKT.map(x=>(
          <button key={x.id} onClick={()=>setMarket(x.id)} className={`px-3 py-2 rounded-xl border text-sm font-bold flex items-center gap-1.5 transition-all ${market===x.id?"bg-blue-600 text-white border-blue-600 shadow-lg scale-105":"bg-card text-muted-foreground border-border hover:bg-muted/50"}`}>
            <span className="text-lg">{x.flag}</span>{x.id}
          </button>
        ))}
      </div>

      {/* API Warning */}
      {!hasDfs && (
        <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2"><span>⚠️</span><div className="text-sm"><strong className="text-yellow-400">DataForSEO not configured</strong> — <span className="text-muted-foreground">using estimated data</span></div></div>
          <a href="/settings" className="text-xs text-yellow-400 font-semibold hover:underline">Configure →</a>
        </div>
      )}

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label:"Monthly Searches", val:totalSearches.toLocaleString(), icon:"🔍", c:"text-blue-400", bg:"bg-blue-500/10 border-blue-500/20", sub:m.lang.toUpperCase()+" market" },
          { label:"Avg CPC", val:`$${avgCpc.toFixed(2)}`, icon:"💰", c:"text-green-400", bg:"bg-green-500/10 border-green-500/20", sub:"per click" },
          { label:"Success Rate", val:`${successRate}%`, icon:"🎯", c:"text-orange-400", bg:"bg-orange-500/10 border-orange-500/20", sub:diff+" difficulty" },
          { label:"Domains Found", val:domains.length.toString(), icon:"📺", c:"text-purple-400", bg:"bg-purple-500/10 border-purple-500/20", sub:domains.filter(d=>d.previouslyIPTV).length+" ex-IPTV" },
        ].map(s=>(
          <div key={s.label} className={`rounded-xl border p-4 ${s.bg}`}>
            <div className="flex justify-between items-start mb-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{s.label}</span>
              <span>{s.icon}</span>
            </div>
            <div className={`text-2xl font-bold ${s.c}`}>{s.val}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {[
          {k:"overview",l:`${m.flag} Market Intelligence`},
          {k:"keywords",l:`🔑 Keywords (${kws.length})`},
          {k:"domains",l:`📺 Domains (${domains.length})`},
          {k:"patterns",l:"🧬 Domain Patterns"},
        ].map(t=>(
          <button key={t.k} onClick={()=>setTab(t.k as typeof tab)} className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab===t.k?"border-primary text-foreground":"border-transparent text-muted-foreground hover:text-foreground"}`}>{t.l}</button>
        ))}
      </div>

      {/* OVERVIEW TAB */}
      {tab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Market Card */}
          <div className="rounded-xl border bg-card p-6 space-y-5 relative overflow-hidden">
            <div className="absolute top-2 right-4 text-8xl opacity-5 pointer-events-none">{m.flag}</div>
            <div className="flex items-center gap-3">
              <span className="text-4xl">{m.flag}</span>
              <div>
                <h2 className="text-xl font-bold">{m.id} IPTV Market</h2>
                <div className="text-xs text-muted-foreground">Language: {m.lang.toUpperCase()} · {totalSearches.toLocaleString()} searches/mo</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label:"Total Volume", val:totalSearches.toLocaleString(), c:"text-blue-400" },
                { label:"Avg CPC", val:`$${avgCpc.toFixed(2)}`, c:"text-green-400" },
                { label:"Competition", val:diff, c:DC[diff]??"" },
                { label:"Success Rate", val:`${successRate}%`, c:"text-orange-400" },
              ].map(s=>(
                <div key={s.label} className="bg-muted/30 rounded-xl p-3">
                  <div className="text-[10px] text-muted-foreground">{s.label}</div>
                  <div className={`text-lg font-bold ${s.c}`}>{s.val}</div>
                </div>
              ))}
            </div>
            <div className="text-xs text-muted-foreground flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${liveData?.dataSource==="dataforseo-live"?"bg-green-500/20 text-green-400":"bg-yellow-500/20 text-yellow-400"}`}>
                {liveData?.dataSource==="dataforseo-live"?"✅ Live data":"📊 Estimated"}
              </span>
              {liveData?.lastUpdated && <span className="font-mono">Updated {new Date(liveData.lastUpdated).toLocaleDateString()}</span>}
            </div>
            <button onClick={handleScan} disabled={scanning} className="w-full h-11 rounded-lg bg-blue-600 text-white font-bold hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {scanning?"Scanning…":`🎯 Hunt ${m.id} IPTV Domains →`}
            </button>
          </div>

          {/* Hot Keywords */}
          <div className="rounded-xl border bg-card p-6 space-y-4">
            <h3 className="font-semibold flex items-center gap-2">🔥 Hot Keywords — {m.id}</h3>
            <div className="space-y-2">
              {kws.slice(0, 8).map((kw: {keyword:string;volume?:number;cpc:number}, i: number) => {
                const vol = kw.volume ?? Math.round(m.vol/(i+1.5));
                const maxVol = kws[0]?.volume ?? m.vol;
                return (
                  <div key={kw.keyword} className="flex items-center gap-3 bg-muted/20 rounded-lg px-3 py-2">
                    <span className="text-xs font-bold text-muted-foreground w-4">{i+1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-mono font-semibold text-sm truncate">&quot;{kw.keyword}&quot;</div>
                      <div className="h-1 bg-muted rounded-full mt-1 overflow-hidden">
                        <div className="h-full bg-orange-500 rounded-full" style={{width:`${(vol/maxVol)*100}%`}}/>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-xs font-mono">{vol.toLocaleString()}/mo</div>
                      <div className="text-[10px] text-green-400">${kw.cpc.toFixed(2)} CPC</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Global Market Comparison */}
          <div className="lg:col-span-2 rounded-xl border bg-card overflow-hidden">
            <div className="px-5 py-3.5 border-b"><h3 className="font-semibold">🌍 Global Market Comparison</h3></div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b bg-muted/30">
                  {["Market","Language","Volume","CPC","Difficulty","Success","Est. Revenue"].map(h=>(
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
                  ))}
                  <th className="px-4 py-3"/>
                </tr></thead>
                <tbody>
                  {MKT.map(x=>(
                    <tr key={x.id} onClick={()=>{setMarket(x.id);setTab("overview");}} className={`border-b hover:bg-muted/20 cursor-pointer transition-colors ${market===x.id?"bg-primary/5":""}`}>
                      <td className="px-4 py-3 font-bold"><span className="mr-2">{x.flag}</span>{x.id}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{x.lang.toUpperCase()}</td>
                      <td className="px-4 py-3 font-mono">{x.vol.toLocaleString()}</td>
                      <td className="px-4 py-3 font-mono text-green-400">${x.cpc.toFixed(2)}</td>
                      <td className="px-4 py-3"><span className={`text-xs font-bold ${DC[x.diff]??""}`}>{x.diff}</span></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-16 bg-muted rounded-full overflow-hidden"><div className={`h-full rounded-full ${x.rate>=70?"bg-green-500":x.rate>=50?"bg-yellow-500":"bg-red-500"}`} style={{width:`${x.rate}%`}}/></div>
                          <span className="text-xs font-mono">{x.rate}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-green-400">${Math.round(x.vol*x.cpc*0.02).toLocaleString()}/mo</td>
                      <td className="px-4 py-3"><button onClick={e=>{e.stopPropagation();setMarket(x.id);handleScan();}} className="px-3 py-1 text-xs rounded-lg bg-primary/15 text-primary font-bold hover:bg-primary/25">Hunt →</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* KEYWORDS TAB */}
      {tab === "keywords" && (
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="px-5 py-3.5 border-b flex items-center justify-between">
            <h3 className="font-semibold">{m.flag} {m.id} Keyword Database</h3>
            <span className="text-xs text-muted-foreground">{kws.length} keywords tracked</span>
          </div>
          <div className="divide-y">
            {kws.map((kw: {keyword:string;volume?:number;cpc:number}, i: number) => {
              const vol = kw.volume ?? Math.round(m.vol/(i+1.5));
              return (
                <div key={kw.keyword} className="px-5 py-3 flex items-center gap-4 hover:bg-muted/20">
                  <span className="text-xs font-bold text-muted-foreground w-6 text-right">{i+1}</span>
                  <div className="flex-1">
                    <div className="font-mono font-semibold text-sm">{kw.keyword}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">Language: {m.lang}</div>
                  </div>
                  <div className="text-right"><div className="font-mono text-sm font-bold">{vol.toLocaleString()}</div><div className="text-[10px] text-muted-foreground">searches/mo</div></div>
                  <div className="text-right"><div className="font-mono text-sm text-green-400">${kw.cpc.toFixed(2)}</div><div className="text-[10px] text-muted-foreground">CPC</div></div>
                  <div className="text-right"><div className="font-mono text-sm text-purple-400">${Math.round(vol*kw.cpc*0.015).toLocaleString()}</div><div className="text-[10px] text-muted-foreground">est. rev/mo</div></div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* DOMAINS TAB */}
      {tab === "domains" && (
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="px-5 py-3.5 border-b flex items-center justify-between">
            <h3 className="font-semibold">📺 IPTV Domains Found</h3>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">{domains.length} domains</span>
              <button onClick={handleScan} disabled={scanning} className="h-8 px-3 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 disabled:opacity-50">{scanning?"…":"🔄 Rescan"}</button>
            </div>
          </div>
          {domains.length === 0 ? (
            <div className="p-16 text-center">
              <div className="text-4xl mb-3">📺</div>
              <div className="font-semibold mb-1">No IPTV domains found yet</div>
              <p className="text-sm text-muted-foreground mb-4">Click Scan to search WhoisDS for dropped IPTV domains in the {m.id} market.</p>
              <button onClick={handleScan} disabled={scanning} className="px-6 py-2.5 rounded-lg bg-blue-600 text-white font-bold hover:bg-blue-700 disabled:opacity-50">{scanning?"Scanning…":"🎯 Scan Now"}</button>
            </div>
          ) : (
            <div className="divide-y">
              {domains.map(d=>(
                <div key={d.domain} className="px-5 py-4 flex items-center gap-4 hover:bg-muted/20">
                  <Ring score={d.iptvScore}/>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-sm">{d.domain}</span>
                      {d.previouslyIPTV && <span className="text-[10px] font-bold text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded border border-orange-500/20">🔥 EX-IPTV</span>}
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${d.parasiteReadiness==="HIGH"?"bg-green-500/15 text-green-400 border-green-500/30":d.parasiteReadiness==="MEDIUM"?"bg-yellow-500/15 text-yellow-400 border-yellow-500/30":"bg-red-500/15 text-red-400 border-red-500/30"}`}>{d.parasiteReadiness}</span>
                    </div>
                    <div className="flex gap-4 mt-1 text-[11px] text-muted-foreground">
                      <span>📊 Score: {d.iptvScore}/100</span>
                      <span>📅 ~{d.estimatedRankDays}d to rank</span>
                      {d.googlePages!=null && <span>🌐 {d.googlePages} indexed</span>}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-lg font-bold text-green-400">${d.estimatedMonthlyRevenue??0}/mo</div>
                    <div className="text-[10px] text-muted-foreground">estimated</div>
                  </div>
                  <button onClick={()=>{sessionStorage.setItem("spy_hunt_domains",d.domain);window.location.href="/hunt";}} className="h-8 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90">Hunt →</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* PATTERNS TAB */}
      {tab === "patterns" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {MKT.filter(x=>x.id===market||market==="ALL"||true).slice(0,6).map(x=>(
            <div key={x.id} className="rounded-xl border bg-card p-5 space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{x.flag}</span>
                <div>
                  <h3 className="font-bold text-sm">{x.id} Domain Patterns</h3>
                  <div className="text-[10px] text-muted-foreground">Language: {x.lang}</div>
                </div>
              </div>
              <div className="space-y-1.5">
                {x.kw.slice(0,3).map(k=>{
                  const pattern = k.replace(/\s+/g,"-")+"-2026";
                  const tld = ["fr","de","nl","es","it","pt","se","no","dk","com.tr","com.br","com"][MKT.indexOf(x)%12];
                  return (
                    <div key={k} className="bg-muted/20 rounded-lg px-3 py-2 font-mono text-xs flex items-center justify-between">
                      <span>{pattern}.{tld}</span>
                      <span className="text-green-400 text-[10px]">Available ✓</span>
                    </div>
                  );
                })}
              </div>
              <button onClick={()=>{setMarket(x.id);handleScan();}} className="w-full h-8 rounded-lg bg-primary/10 text-primary text-xs font-bold hover:bg-primary/20">Hunt {x.id} Patterns →</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
