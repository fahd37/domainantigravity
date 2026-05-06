"use client";
import React, { useState, useEffect } from "react";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";

interface HuntResult { domain:string; niche:string; score:number; verdict:string; indexed:boolean; pageCount:number; traffic:number; keywords:number; refs:number; age:number; status:string; matchedKeyword:string }
interface PipelineData { success:boolean; totalDrops?:number; nicheMatches?:number; available?:number; scored?:number; cleanHistory?:number; googleIndexed?:number; queued?:number; domainsSaved?:number; elapsed?:string; results?:HuntResult[]; error?:string; log?:string[] }

export default function HuntPage() {
  const [mode, setMode] = useState<"auto"|"manual">("auto");
  const [niches, setNiches] = useState<{slug:string;displayName:string}[]>([]);
  const [selectedNiche, setSelectedNiche] = useState("all");
  const [threshold, setThreshold] = useState([60]);
  const [autoBuy, setAutoBuy] = useState(false);
  const [running, setRunning] = useState(false);
  const [pipeline, setPipeline] = useState<PipelineData|null>(null);
  const [results, setResults] = useState<HuntResult[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [domainInput, setDomainInput] = useState("");
  const [hasNc, setHasNc] = useState(false);

  useEffect(() => {
    fetch("/api/niches").then(r=>r.json()).then(j=>{if(j.data) setNiches(j.data.filter((n:{active:boolean})=>n.active));}).catch(()=>{});
    fetch("/api/settings").then(r=>r.json()).then(j=>{if(j.data) setHasNc(!!(j.data.nc_api_user||j.data.namecheapApiUser));}).catch(()=>{});
  }, []);

  const runPipeline = async () => {
    setRunning(true); setPipeline(null); setResults([]); setLogs([]);
    try {
      const r = await fetch("/api/hunt/run", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ niche: selectedNiche }) });
      const data: PipelineData = await r.json();
      setPipeline(data);
      if (data.results) setResults(data.results);
      if (data.log) setLogs(data.log);
    } catch(e) { setPipeline({ success:false, error:String(e) }); }
    finally { setRunning(false); }
  };

  const scoreManual = async () => {
    if (!domainInput.trim()) return;
    const domains = domainInput.split("\n").map(d=>d.trim().toLowerCase()).filter(d=>d.includes("."));
    if (!domains.length) return;
    setRunning(true); setResults([]); setPipeline(null);
    try {
      const r = await fetch("/api/score-preview", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ domains, nicheSlug:selectedNiche==="all"?undefined:selectedNiche }) });
      const data = await r.json();
      if (data.results) {
        setResults(data.results.map((d: {domain:string;total:number;recommendation:string;matchedNiche?:string;googleIndexed?:boolean;googlePageCount?:number;referringDomains?:number}) => ({
          domain:d.domain, niche:d.matchedNiche||"—", score:d.total||0, verdict:"—", indexed:d.googleIndexed||false, pageCount:d.googlePageCount||0,
          traffic:0, keywords:0, refs:d.referringDomains||0, age:0, status:d.recommendation==="buy"?"QUEUED":d.recommendation==="watch"?"PENDING":"REJECTED", matchedKeyword:"manual"
        })));
      }
    } catch {}
    finally { setRunning(false); }
  };

  const handleBuy = async (domain:string, score:number) => {
    try { await fetch("/api/purchase/buy",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({domain,score,niche:selectedNiche})}); } catch {}
  };

  const filteredResults = results.filter(r => r.score >= threshold[0]);
  const buyCount = filteredResults.filter(r => r.status === "QUEUED").length;

  return (
    <div className="flex flex-col gap-5 pb-10">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">🎯 Domain Hunter</h1>
          <p className="text-muted-foreground mt-1 text-sm">Find expired domains with SEO value through the 5-engine pipeline</p>
        </div>
        {results.length>0 && (
          <div className="flex gap-2">
            {[{l:"Found",v:results.length,c:"text-foreground"},{l:"≥ Threshold",v:filteredResults.length,c:"text-purple-400"},{l:"Buy",v:buyCount,c:"text-green-400"}].map(s=>(
              <div key={s.l} className="rounded-xl border bg-card px-3 py-1.5 text-center min-w-[50px]"><div className={`text-lg font-bold ${s.c}`}>{s.v}</div><div className="text-[9px] text-muted-foreground">{s.l}</div></div>
            ))}
          </div>
        )}
      </div>

      {/* Mode Tabs */}
      <div className="flex gap-1 border-b">
        <button onClick={()=>setMode("auto")} className={`px-4 py-2.5 text-sm font-medium border-b-2 ${mode==="auto"?"border-primary text-foreground":"border-transparent text-muted-foreground hover:text-foreground"}`}>🔍 Run Pipeline</button>
        <button onClick={()=>setMode("manual")} className={`px-4 py-2.5 text-sm font-medium border-b-2 ${mode==="manual"?"border-primary text-foreground":"border-transparent text-muted-foreground hover:text-foreground"}`}>📝 Manual Entry</button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Controls */}
        <div className="space-y-4">
          <div className="rounded-xl border bg-card p-5 space-y-4">
            {mode==="auto" ? (
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
                <h3 className="font-bold text-sm text-blue-400 mb-1">🔍 Auto Pipeline</h3>
                <p className="text-[11px] text-muted-foreground">Downloads today&apos;s expired domains from WhoisFreaks, filters by niche, scores with DataForSEO, checks Wayback + Google Index.</p>
              </div>
            ) : (
              <div className="space-y-2">
                <label className="text-sm font-semibold">Paste Domains</label>
                <textarea className="w-full min-h-[100px] rounded-lg border border-input bg-transparent px-3 py-2 text-sm font-mono resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" placeholder={"example.com\ntest.net"} value={domainInput} onChange={e=>setDomainInput(e.target.value)}/>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-sm font-semibold">Niche</label>
              <select className="w-full h-9 rounded-lg border border-input bg-transparent px-3 text-sm" value={selectedNiche} onChange={e=>setSelectedNiche(e.target.value)}>
                <option value="all">All Niches</option>
                {niches.map(n=><option key={n.slug} value={n.slug}>{n.displayName}</option>)}
              </select>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between"><label className="text-sm font-semibold">Buy Threshold</label><span className="text-sm font-mono font-bold text-primary">{threshold[0]}</span></div>
              <Slider min={0} max={100} step={1} value={threshold} onValueChange={v=>setThreshold(v as number[])}/>
            </div>

            <div className="flex items-center justify-between border-t pt-3">
              <div><div className="text-sm font-semibold">Auto-Buy</div><div className="text-[10px] text-muted-foreground">Purchase if score ≥ {threshold[0]}</div></div>
              <Switch checked={autoBuy} onCheckedChange={setAutoBuy} disabled={!hasNc}/>
            </div>

            <button onClick={mode==="auto"?runPipeline:scoreManual} disabled={running||(mode==="manual"&&!domainInput.trim())} className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2">
              {running?<><span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Running…</>:mode==="auto"?"🔍 Run Pipeline":"🚀 Score Domains"}
            </button>
          </div>

          {/* Pipeline Progress */}
          {pipeline && pipeline.success && (
            <div className="rounded-xl border bg-card p-4 space-y-1">
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Pipeline Progress</div>
              {[
                { l:`Downloaded ${pipeline.totalDrops?.toLocaleString()} drops`, done:true },
                { l:`Filtered: ${pipeline.nicheMatches} niche matches`, done:(pipeline.nicheMatches??0)>0 },
                { l:`Available: ${pipeline.available} domains`, done:(pipeline.available??0)>0 },
                { l:`Scored: ${pipeline.scored} domains`, done:(pipeline.scored??0)>0 },
                { l:`Clean history: ${pipeline.cleanHistory} domains`, done:true },
                { l:`Google indexed: ${pipeline.googleIndexed} domains`, done:true },
                { l:`Queued (≥60): ${pipeline.queued} domains`, done:true },
              ].map((s,i)=>(
                <div key={i} className="text-xs flex items-center gap-2"><span className={s.done?"text-green-400":"text-yellow-400"}>{s.done?"✅":"⏳"}</span>{s.l}</div>
              ))}
              <div className="text-[10px] text-muted-foreground mt-1">⏱ {pipeline.elapsed}</div>
            </div>
          )}

          {/* Logs */}
          {logs.length > 0 && (
            <details className="rounded-xl border bg-card p-4">
              <summary className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground cursor-pointer">Pipeline Logs ({logs.length})</summary>
              <div className="mt-2 max-h-48 overflow-y-auto space-y-0.5">
                {logs.map((l,i)=><div key={i} className={`text-[10px] font-mono ${l.includes("ERROR")?"text-red-400":"text-muted-foreground"}`}>{l}</div>)}
              </div>
            </details>
          )}
        </div>

        {/* Results */}
        <div className="lg:col-span-2">
          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="px-5 py-3.5 border-b flex items-center justify-between">
              <h2 className="font-semibold text-sm">Results</h2>
              {results.length>0&&<span className="text-xs text-muted-foreground">{filteredResults.length} above threshold</span>}
            </div>

            {running && <div className="flex flex-col items-center gap-4 p-16"><div className="h-10 w-10 border-2 border-primary/30 border-t-primary rounded-full animate-spin"/><div className="text-sm text-muted-foreground">Running pipeline…</div></div>}

            {!running && filteredResults.length === 0 && (
              <div className="p-16 text-center">
                <div className="text-4xl mb-3">🎯</div>
                <div className="font-semibold mb-1">{mode==="auto"?"Ready to hunt":"No results yet"}</div>
                <p className="text-sm text-muted-foreground">{mode==="auto"?"Select a niche and click Run Pipeline":"Paste domains and click Score"}</p>
              </div>
            )}

            {filteredResults.length > 0 && (
              <table className="w-full text-xs">
                <thead><tr className="border-b text-muted-foreground">
                  <th className="text-left px-4 py-2 font-medium">Domain</th>
                  <th className="text-left px-4 py-2 font-medium">Niche</th>
                  <th className="text-center px-4 py-2 font-medium">Score</th>
                  <th className="text-center px-4 py-2 font-medium">Verdict</th>
                  <th className="text-center px-4 py-2 font-medium">IDX</th>
                  <th className="text-right px-4 py-2 font-medium">Action</th>
                </tr></thead>
                <tbody>
                  {filteredResults.map(r=>(
                    <tr key={r.domain} className="border-b last:border-0 hover:bg-muted/20">
                      <td className="px-4 py-2.5 font-mono font-bold">{r.domain}</td>
                      <td className="px-4 py-2.5"><span className="px-2 py-0.5 rounded bg-primary/10 text-primary text-[10px]">{r.niche.replace(/_/g," ")}</span></td>
                      <td className="px-4 py-2.5 text-center"><span className={`font-bold ${r.score>=60?"text-green-400":r.score>=40?"text-yellow-400":"text-red-400"}`}>{r.score}</span></td>
                      <td className="px-4 py-2.5 text-center"><span className={`text-[10px] font-bold ${r.verdict==="CLEAN"?"text-green-400":r.verdict==="TOXIC"?"text-red-400":"text-muted-foreground"}`}>{r.verdict}</span></td>
                      <td className="px-4 py-2.5 text-center">{r.indexed?<span className="text-green-400">✅ {r.pageCount}</span>:<span className="text-red-400">❌</span>}</td>
                      <td className="px-4 py-2.5 text-right">
                        {r.status !== "REJECTED" && (
                          <button onClick={()=>handleBuy(r.domain,r.score)} className={`h-6 px-2.5 rounded text-[10px] font-bold ${r.score>=threshold[0]?"bg-green-600 text-white hover:bg-green-700":"border border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/10"}`}>
                            {r.score>=threshold[0]?"🛒 Buy":"👁 Watch"}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
