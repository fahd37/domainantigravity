"use client";
import React, { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";

interface HuntResult {
  domain: string; total: number; recommendation: "buy"|"watch"|"reject";
  filterReason?: string; ageYears?: number; googleIndexed?: boolean; googlePageCount?: number;
  matchedNiche?: string; parasiteReadiness?: "HIGH"|"MEDIUM"|"LOW"; isToxic?: boolean;
  referringDomains?: number; waybackCount?: number;
  breakdown?: { googleIndex:number; topicalAuthority:number; anchorRelevance:number; keywordHistory:number; age:number };
  historicalKeywords?: { keyword:string; searchVolume:number; position:number }[];
}

type Stage = "idle"|"running"|"done"|"skipped"|"error";

function Ring({ score }: { score:number }) {
  const c=score>=60?"#22c55e":score>=40?"#eab308":"#ef4444";
  const r=14,circ=2*Math.PI*r,dash=(score/100)*circ;
  return <svg width="36" height="36" viewBox="0 0 36 36" className="flex-shrink-0"><circle cx="18" cy="18" r={r} fill="none" stroke="currentColor" strokeWidth="2.5" className="text-muted/30"/><circle cx="18" cy="18" r={r} fill="none" stroke={c} strokeWidth="2.5" strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" transform="rotate(-90 18 18)"/><text x="18" y="18" textAnchor="middle" dominantBaseline="central" fill={c} fontSize="9" fontWeight="bold">{score}</text></svg>;
}

function StageChip({ label, icon, stage }: { label:string; icon:string; stage:Stage }) {
  const s:Record<Stage,string>={idle:"border-border text-muted-foreground",running:"border-blue-500/50 text-blue-400 animate-pulse",done:"border-green-500/50 text-green-400",skipped:"border-yellow-500/30 text-yellow-500/60",error:"border-red-500/50 text-red-400"};
  return <div className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-medium ${s[stage]}`}><span>{icon}</span><span>{label}</span><span className={`h-1.5 w-1.5 rounded-full ${stage==="running"?"bg-blue-500 animate-ping":stage==="done"?"bg-green-500":stage==="error"?"bg-red-500":"bg-muted-foreground/40"}`}/></div>;
}

export default function HuntPage() {
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<"auto"|"manual">("auto");
  const [niches, setNiches] = useState<{slug:string;displayName:string}[]>([]);
  const [selectedNiche, setSelectedNiche] = useState("");
  const [domainInput, setDomainInput] = useState("");
  const [threshold, setThreshold] = useState([60]);
  const [autoBuy, setAutoBuy] = useState(false);
  const [isScoring, setIsScoring] = useState(false);
  const [results, setResults] = useState<HuntResult[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [expandedId, setExpandedId] = useState<string|null>(null);
  const [hasDfs, setHasDfs] = useState(false);
  const [hasNc, setHasNc] = useState(false);
  const [stages, setStages] = useState<Record<string,Stage>>({whoisfreaks:"idle",googleIndex:"idle",wayback:"idle",dataforseo:"idle",scoring:"idle"});
  const [droppedCount, setDroppedCount] = useState(0);
  const logsRef = useRef<HTMLDivElement>(null);

  const addLog = (msg: string) => { const t=new Date().toLocaleTimeString("en",{hour12:false}); setLogs(p=>[`[${t}] ${msg}`,...p.slice(0,99)]); };

  useEffect(() => {
    fetch("/api/niches").then(r=>r.json()).then(j=>{if(j.data)setNiches(j.data.filter((n:{active:boolean})=>n.active));}).catch(()=>{});
    fetch("/api/settings").then(r=>r.json()).then(j=>{if(j.data){const d=j.data;setHasDfs(!!(d.dfs_email||d.dataForSeoEmail)&&!!(d.dfs_password||d.dataForSeoPassword));setHasNc(!!(d.nc_api_user)&&!!(d.nc_api_key));}}).catch(()=>{});
  }, []);

  useEffect(() => {
    const n=searchParams.get("niche"), t=searchParams.get("threshold"), s=searchParams.get("source");
    if(n) setSelectedNiche(n);
    if(t) setThreshold([parseInt(t)]);
    if(s==="intelligence"||s==="dashboard") setMode("auto");
  }, [searchParams]);

  const handleAutoHunt = async () => {
    setIsScoring(true); setResults([]); setLogs([]); setDroppedCount(0);
    setStages({whoisfreaks:"running",googleIndex:"idle",wayback:"idle",dataforseo:"idle",scoring:"idle"});
    addLog(`🚀 AUTO-HUNT: Fetching dropped domains from WhoisFreaks…`);
    addLog(`📋 Niche filter: ${selectedNiche||"All niches"} · Threshold: ${threshold[0]}`);

    try {
      // Step 1: Call the cron/scan endpoint which fetches from WhoisFreaks
      const res = await fetch('/api/cron/scan', {
        headers: { 'x-cron-secret': process.env.NEXT_PUBLIC_CRON_SECRET || 'change-me-random-string-32chars' }
      });
      
      setStages(s=>({...s,whoisfreaks:"done",googleIndex:"running",wayback:"running"}));
      addLog("✅ WhoisFreaks: Dropped domains fetched");
      
      const data = await res.json();
      
      if (data.success) {
        setDroppedCount(data.domainsFound||0);
        addLog(`📊 Found ${data.domainsFound||0} dropped domains`);
        addLog(`💾 Saved ${data.domainsSaved||0} to database`);
        setStages(s=>({...s,googleIndex:"done",wayback:"done",dataforseo:hasDfs?"done":"skipped",scoring:"done"}));
        
        // Now fetch the scored domains from DB
        addLog("🔍 Loading scored results from database…");
        const dbRes = await fetch(`/api/domains${selectedNiche?`?niche=${selectedNiche}`:""}`);
        const dbData = await dbRes.json();
        
        if (dbData.data) {
          const scored: HuntResult[] = dbData.data
            .filter((d: {score?:number}) => (d.score??0) > 0)
            .sort((a: {score?:number}, b: {score?:number}) => (b.score??0) - (a.score??0))
            .slice(0, 50)
            .map((d: {name:string;score?:number;status:string;niche?:string;googleIndexed?:boolean;waybackPages?:number;referringDomains?:number;filterReason?:string}) => ({
              domain: d.name,
              total: d.score ?? 0,
              recommendation: (d.score??0) >= threshold[0] ? "buy" as const : (d.score??0) >= threshold[0]*0.6 ? "watch" as const : "reject" as const,
              googleIndexed: d.googleIndexed,
              matchedNiche: d.niche,
              waybackCount: d.waybackPages,
              referringDomains: d.referringDomains,
              filterReason: d.filterReason,
            }));
          
          setResults(scored);
          const buyCount = scored.filter(r => r.recommendation === "buy").length;
          addLog(`✅ Pipeline complete: ${scored.length} domains scored`);
          addLog(`🛒 ${buyCount} domain(s) above buy threshold (${threshold[0]})`);
          
          if (autoBuy && hasNc) {
            for (const r of scored) {
              if (r.recommendation === "buy") {
                addLog(`🤖 Auto-buy: ${r.domain} (score ${r.total})`);
                handleBuy(r.domain, r.total, selectedNiche);
              }
            }
          }
        }
      } else {
        setStages(s=>({...s,scoring:"error"}));
        addLog(`❌ Scan error: ${data.error||data.log?.join(', ')||'Unknown'}`);
      }
    } catch (e) {
      setStages(s=>({...s,whoisfreaks:"error"}));
      addLog(`❌ Error: ${String(e)}`);
    } finally {
      setIsScoring(false);
    }
  };

  const handleManualHunt = async () => {
    if(!domainInput.trim()) return;
    const domains = domainInput.split("\n").map(d=>d.trim().toLowerCase()).filter(d=>d.length>0&&d.includes("."));
    if(domains.length===0) return;

    setIsScoring(true); setResults([]); setLogs([]);
    setStages({whoisfreaks:"done",googleIndex:"running",wayback:"running",dataforseo:hasDfs?"running":"skipped",scoring:"running"});
    addLog(`🚀 Manual hunt: ${domains.length} domain(s)`);

    try {
      const res = await fetch("/api/score-preview",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({domains,nicheSlug:selectedNiche||undefined,autoBuy})});
      const json = await res.json();
      if(json.results){
        setResults(json.results);
        setStages({whoisfreaks:"done",googleIndex:"done",wayback:"done",dataforseo:hasDfs?"done":"skipped",scoring:"done"});
        addLog(`✅ ${json.results.length} domains scored`);
      } else {
        setStages(s=>({...s,scoring:"error"}));
        addLog(`❌ ${json.error}`);
      }
    } catch(e) {
      setStages(s=>({...s,scoring:"error"}));
      addLog(`❌ ${e}`);
    } finally { setIsScoring(false); }
  };

  const handleBuy = async (domain:string, score:number, niche:string) => {
    addLog(`🛒 Purchasing ${domain}…`);
    try {
      const r=await fetch("/api/purchase/buy",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({domain,score,niche})});
      const d=await r.json();
      addLog(d.error?`❌ ${d.error}`:`✅ ${domain} queued!`);
    } catch { addLog(`❌ Buy failed for ${domain}`); }
  };

  const bought=results.filter(r=>r.recommendation==="buy").length;

  return (
    <div className="flex flex-col gap-5 pb-10">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">🎯 Domain Hunt</h1>
          <p className="text-muted-foreground mt-1.5 text-sm">Find expired domains with SEO value through WhoisFreaks → Google Index → Wayback → DataForSEO pipeline.</p>
        </div>
        {results.length>0&&(
          <div className="flex gap-2 text-center">
            {[{l:"Buy",v:bought,c:"text-green-400"},{l:"Watch",v:results.filter(r=>r.recommendation==="watch").length,c:"text-yellow-400"},{l:"Total",v:results.length,c:"text-foreground"}].map(s=>(
              <div key={s.l} className="rounded-xl border bg-card px-4 py-2 min-w-[55px]"><div className={`text-xl font-bold ${s.c}`}>{s.v}</div><div className="text-[10px] text-muted-foreground">{s.l}</div></div>
            ))}
          </div>
        )}
      </div>

      {/* Mode Selector */}
      <div className="flex gap-1 border-b border-border">
        <button onClick={()=>setMode("auto")} className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${mode==="auto"?"border-primary text-foreground":"border-transparent text-muted-foreground hover:text-foreground"}`}>🔍 Auto-Hunt (Find Expired Domains)</button>
        <button onClick={()=>setMode("manual")} className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${mode==="manual"?"border-primary text-foreground":"border-transparent text-muted-foreground hover:text-foreground"}`}>📝 Manual (Paste Domains)</button>
      </div>

      {/* Pipeline */}
      <div className="flex gap-2 items-center flex-wrap">
        {[["WhoisFreaks","🔍","whoisfreaks"],["Google Index","🌐","googleIndex"],["Wayback","📚","wayback"],["DataForSEO","📊","dataforseo"],["Scoring","⚙️","scoring"]].map(([l,i,k],idx)=>(
          <React.Fragment key={k}>{idx>0&&<span className="text-muted-foreground">→</span>}<StageChip label={l} icon={i} stage={stages[k]}/></React.Fragment>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left Panel */}
        <div className="space-y-4">
          <div className="rounded-xl border bg-card p-5 space-y-4">
            {mode==="auto"?(
              <>
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
                  <h3 className="font-bold text-sm text-blue-400 mb-1">🔍 Auto-Hunt Mode</h3>
                  <p className="text-xs text-muted-foreground">Automatically fetches today&apos;s expired/dropped domains from WhoisFreaks, filters by niche keywords, scores through the full pipeline, and presents opportunities.</p>
                </div>
                {droppedCount>0&&<div className="text-xs text-green-400 bg-green-500/10 rounded-lg px-3 py-2 border border-green-500/20">✅ {droppedCount} dropped domains found in last scan</div>}
              </>
            ):(
              <div className="space-y-2">
                <label className="text-sm font-semibold">Domains to Analyse</label>
                <textarea className="w-full min-h-[120px] rounded-lg border border-input bg-transparent px-3 py-2 text-sm font-mono resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" placeholder={"example.com\ntest.net\nmydomain.io"} value={domainInput} onChange={e=>setDomainInput(e.target.value)}/>
                <p className="text-[10px] text-muted-foreground">One domain per line</p>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-sm font-semibold">Target Niche</label>
              <select className="w-full h-9 rounded-lg border border-input bg-transparent px-3 text-sm" value={selectedNiche} onChange={e=>setSelectedNiche(e.target.value)}>
                <option value="">All Niches</option>
                {niches.map(n=><option key={n.slug} value={n.slug}>{n.displayName}</option>)}
              </select>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between"><label className="text-sm font-semibold">Buy Threshold</label><span className="text-sm font-mono font-bold text-primary">{threshold[0]}</span></div>
              <Slider min={0} max={100} step={1} value={threshold} onValueChange={v=>setThreshold(v as number[])}/>
              <div className="flex justify-between text-[9px] text-muted-foreground"><span>0 — Accept all</span><span>100 — Perfect only</span></div>
            </div>

            <div className="flex items-center justify-between border-t pt-3">
              <div><div className="text-sm font-semibold">Auto-Buy</div><div className="text-[10px] text-muted-foreground">Purchase if score ≥ {threshold[0]}</div></div>
              <Switch checked={autoBuy} onCheckedChange={setAutoBuy} disabled={!hasNc}/>
            </div>

            <button onClick={mode==="auto"?handleAutoHunt:handleManualHunt} disabled={isScoring||(mode==="manual"&&!domainInput.trim())} className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2">
              {isScoring?<><span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Hunting…</>:mode==="auto"?"🔍 Find Expired Domains Now":"🚀 Score Domains"}
            </button>
          </div>

          {/* Warnings */}
          {!hasDfs&&<div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 flex items-center justify-between"><div className="flex items-center gap-2"><span>⚠️</span><span className="text-xs text-yellow-400">DataForSEO not configured</span></div><a href="/settings" className="text-[10px] text-yellow-400 font-bold hover:underline">Fix →</a></div>}
          {!hasNc&&<div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 flex items-center justify-between"><div className="flex items-center gap-2"><span>🔴</span><span className="text-xs text-red-400">Namecheap not configured</span></div><a href="/settings" className="text-[10px] text-red-400 font-bold hover:underline">Fix →</a></div>}

          {/* Logs */}
          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Live Pipeline Logs</span>
              {logs.length>0&&<button onClick={()=>setLogs([])} className="text-[10px] text-muted-foreground hover:text-foreground">Clear</button>}
            </div>
            <div ref={logsRef} className="space-y-0.5 max-h-56 overflow-y-auto">
              {logs.length===0?<div className="text-[11px] text-muted-foreground italic">Logs appear when hunt starts…</div>:
                logs.map((l,i)=><div key={i} className={`text-[11px] font-mono leading-relaxed ${l.includes("❌")?"text-red-400":l.includes("✅")?"text-green-400":l.includes("⚠")?"text-yellow-400":l.includes("🛒")?"text-blue-400":"text-muted-foreground"}`}>{l}</div>)}
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="lg:col-span-2 space-y-4">
          {results.length>0&&(
            <div className="grid grid-cols-4 gap-3">
              {[{l:"Scanned",v:results.length,c:"text-foreground"},{l:"Indexed",v:results.filter(r=>r.googleIndexed).length,c:"text-blue-400"},{l:"Score ≥ 60",v:results.filter(r=>r.total>=60).length,c:"text-purple-400"},{l:"Buy Now",v:bought,c:"text-green-400"}].map(s=>(
                <div key={s.l} className="rounded-xl border bg-card p-3 text-center"><div className={`text-xl font-bold ${s.c}`}>{s.v}</div><div className="text-[10px] text-muted-foreground">{s.l}</div></div>
              ))}
            </div>
          )}

          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="px-5 py-3.5 border-b flex items-center justify-between">
              <h2 className="font-semibold text-sm">Results</h2>
              {results.length>0&&<span className="text-xs text-muted-foreground">{results.length} domains</span>}
            </div>

            {isScoring&&<div className="flex flex-col items-center gap-4 p-16 text-muted-foreground"><div className="h-10 w-10 border-2 border-primary/30 border-t-primary rounded-full animate-spin"/><div className="text-sm">Running pipeline…</div></div>}

            {!isScoring&&results.length===0&&(
              <div className="p-16 text-center">
                <div className="text-4xl mb-3">🎯</div>
                <div className="font-semibold mb-1">{mode==="auto"?"Ready to hunt":"No results yet"}</div>
                <p className="text-sm text-muted-foreground">{mode==="auto"?"Click \"Find Expired Domains Now\" to auto-fetch and score dropped domains":"Enter domains on the left and click Score Domains"}</p>
              </div>
            )}

            {results.length>0&&(
              <div className="divide-y">
                {results.map(r=>{
                  const exp=expandedId===r.domain;
                  const rc=r.recommendation==="buy"?"bg-green-500/15 text-green-400 border-green-500/30":r.recommendation==="watch"?"bg-yellow-500/15 text-yellow-400 border-yellow-500/30":"bg-red-500/15 text-red-400 border-red-500/30";
                  return (
                    <div key={r.domain} className="hover:bg-muted/20 transition-colors">
                      <div className="px-5 py-3 flex items-center gap-3">
                        <Ring score={r.total||0}/>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-bold text-sm">{r.domain}</span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${rc}`}>{r.recommendation?.toUpperCase()}</span>
                            {r.matchedNiche&&r.matchedNiche!=="unknown"&&<span className="px-2 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-semibold">{r.matchedNiche.replace(/_/g," ")}</span>}
                            {r.isToxic&&<span className="text-[10px] text-red-400 font-bold">☠ TOXIC</span>}
                          </div>
                          <div className="flex gap-4 mt-1 text-[11px] text-muted-foreground flex-wrap">
                            <span>{r.googleIndexed?`✅ ${r.googlePageCount??0} pages`:"❌ Not indexed"}</span>
                            {r.waybackCount!=null&&<span>📚 {r.waybackCount}</span>}
                            {r.referringDomains!=null&&<span>🔗 {r.referringDomains} refs</span>}
                            {r.ageYears!=null&&r.ageYears>0&&<span>📅 {r.ageYears}y</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {r.recommendation!=="reject"&&<button onClick={()=>handleBuy(r.domain,r.total,selectedNiche)} className={`h-7 px-3 rounded-lg text-[10px] font-bold ${r.recommendation==="buy"?"bg-green-600 text-white hover:bg-green-700":"border border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/10"}`}>{r.recommendation==="buy"?"🛒 Buy":"👁 Watch"}</button>}
                          <button onClick={()=>setExpandedId(exp?null:r.domain)} className="h-7 w-7 rounded-lg border flex items-center justify-center text-muted-foreground hover:text-foreground text-xs">{exp?"▲":"▼"}</button>
                        </div>
                      </div>
                      <div className="px-5 pb-1"><div className="h-1 bg-muted rounded-full overflow-hidden"><div className={`h-full rounded-full ${r.total>=60?"bg-green-500":r.total>=40?"bg-yellow-500":"bg-red-500"}`} style={{width:`${Math.min(100,r.total)}%`}}/></div></div>
                      {exp&&(
                        <div className="px-5 pb-4 pt-2 bg-muted/10 border-t">
                          {r.breakdown&&<div className="grid grid-cols-5 gap-2 mb-3">{[["Google",r.breakdown.googleIndex],["Authority",r.breakdown.topicalAuthority],["Anchors",r.breakdown.anchorRelevance],["Keywords",r.breakdown.keywordHistory],["Age",r.breakdown.age]].map(([l,v])=><div key={l as string} className="bg-card border rounded-lg p-2 text-center"><div className="text-[10px] text-muted-foreground">{l}</div><div className="font-bold text-sm">{v??0}</div></div>)}</div>}
                          {r.historicalKeywords&&r.historicalKeywords.length>0&&<div className="grid grid-cols-3 gap-2">{r.historicalKeywords.slice(0,6).map((kw,i)=><div key={i} className="bg-card border rounded-lg px-3 py-2 text-xs"><div className="font-semibold truncate">{kw.keyword}</div><div className="text-muted-foreground flex justify-between mt-0.5"><span>{kw.searchVolume?.toLocaleString()}/mo</span><span>#{kw.position}</span></div></div>)}</div>}
                          {r.filterReason&&<div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 mt-2">⚠ {r.filterReason}</div>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
