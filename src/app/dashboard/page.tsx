"use client";
import { useEffect, useState, useCallback } from "react";

interface DashboardStatus {
  lastScan: { startedAt: string; domainsFound: number; status: string } | null;
  lastPurchase: { domain: string; price: number | null; boughtAt: string | null } | null;
  queue: { pending: number; dailyCount: number; dailySpend: number; killSwitchActive: boolean };
}
interface ScanProgress {
  running: boolean; processed: number; total: number; passed: number; failed: number;
  passRate: string; ratePerMin: number; estimatedRemainingMs: number;
  sourcesActive: Record<string, boolean>; rateLimits: Record<string, { remaining: number; dayCount: number; dayLimit?: number }>;
}

function timeAgo(d: string|null|undefined) {
  if(!d) return "Never";
  const ms=Date.now()-new Date(d).getTime(), m=Math.floor(ms/60000), h=Math.floor(m/60), dy=Math.floor(h/24);
  return dy>0?`${dy}d ago`:h>0?`${h}h ago`:m>0?`${m}m ago`:"Just now";
}

function Ring({ score, size=44 }: { score:number; size?:number }) {
  const c=score>=55?"#22c55e":score>=35?"#eab308":"#ef4444";
  const r=16,circ=2*Math.PI*r,dash=(Math.min(score,100)/100)*circ;
  return <svg width={size} height={size} viewBox="0 0 40 40"><circle cx="20" cy="20" r={r} fill="none" stroke="currentColor" strokeWidth="3" className="text-muted/30"/><circle cx="20" cy="20" r={r} fill="none" stroke={c} strokeWidth="3" strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" transform="rotate(-90 20 20)"/><text x="20" y="20" textAnchor="middle" dominantBaseline="central" fill={c} fontSize="10" fontWeight="bold">{score}</text></svg>;
}

export default function DashboardPage() {
  const [stats, setStats] = useState({ indexedDomains:0, avgParasiteScore:0, highReadiness:0, keywordsIdentified:0 });
  const [status, setStatus] = useState<DashboardStatus|null>(null);
  const [scan, setScan] = useState<ScanProgress|null>(null);
  const [killActive, setKillActive] = useState(false);
  const [togglingKill, setTogglingKill] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [topNiches, setTopNiches] = useState<{displayName:string;parasiteSuccessRate:number;avgTimeToRank:number;opportunity:string;slug:string;opportunityScore?:number}[]>([]);
  const [apis, setApis] = useState({ whoisfreaks:true, dataforseo:false, googleIndex:false, wayback:true });

  const fetchAll = useCallback(async () => {
    const [s1,s2] = await Promise.allSettled([
      fetch("/api/dashboard/stats").then(r=>r.json()),
      fetch("/api/dashboard/status").then(r=>r.json()),
    ]);
    if(s1.status==="fulfilled"&&!s1.value.error) setStats(s1.value);
    if(s2.status==="fulfilled"&&!s2.value.error) { setStatus(s2.value); setKillActive(s2.value.queue?.killSwitchActive??false); }
  }, []);

  const fetchProgress = useCallback(async () => {
    try { const r=await fetch("/api/scan/progress"); if(r.ok) setScan(await r.json()); } catch{}
  }, []);

  useEffect(() => {
    fetchAll(); fetchProgress();
    const a=setInterval(fetchAll,30000), b=setInterval(fetchProgress,5000);
    return ()=>{clearInterval(a);clearInterval(b);};
  }, [fetchAll, fetchProgress]);

  useEffect(() => {
    fetch('/api/niche-intelligence').then(r=>r.json()).then(j=>{
      if(j.niches) setTopNiches(j.niches.slice(0,5));
    }).catch(()=>{});
  }, []);

  useEffect(() => {
    fetch('/api/settings').then(r=>r.json()).then(j=>{
      if(j.data){const d=j.data;setApis({whoisfreaks:!!d.whoisfreaksApiKey,dataforseo:!!(d.dfs_email||d.dataForSeoEmail)&&!!(d.dfs_password||d.dataForSeoPassword),googleIndex:!!d.google_sa_key,wayback:true});}
    }).catch(()=>{});
  }, []);

  const toggleKill = async () => {
    setTogglingKill(true);
    try { const r=await fetch("/api/purchase/killswitch",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({active:!killActive})}); if(r.ok){setKillActive(!killActive);await fetchAll();} } finally { setTogglingKill(false); }
  };

  const triggerScan = async () => {
    setScanning(true);
    try {
      const r=await fetch('/api/cron/scan',{headers:{'x-cron-secret':process.env.NEXT_PUBLIC_CRON_SECRET||'change-me-random-string-32chars'}});
      const data=await r.json();
      if(!data.success||!r.ok) {
        alert(`Scan failed:\n${data.log?.join('\n')||data.error||'Unknown'}`);
      } else {
        const msg = [
          `═══ DROP-FEED PIPELINE COMPLETE ═══`,
          ``,
          `Total drops downloaded: ${data.totalDrops?.toLocaleString() || data.domainsFound || 0}`,
          `Niche keyword matches: ${data.nicheMatches || 0}`,
          `Available to register: ${data.available || 0}`,
          `DataForSEO scored: ${data.scored || 0}`,
          `Clean Wayback history: ${data.cleanHistory || 0}`,
          `Google indexed: ${data.googleIndexed || 0}`,
          `Queued for purchase: ${data.queued || 0}`,
          `Saved to database: ${data.domainsSaved || 0}`,
          `Time: ${data.elapsed || '?'}`,
          ``,
          data.topFinds?.length > 0 ? `🏆 Top find: ${data.topFinds[0].domain} (Score: ${data.topFinds[0].score})` : ''
        ].filter(Boolean).join('\n');
        alert(msg);
        await fetchAll();
      }
    } catch(e) { alert(`Scan failed: ${e}`); } finally { setScanning(false); }
  };

  const dc=status?.queue.dailyCount??0, ds=status?.queue.dailySpend??0;
  const engineOk = Object.values(apis).filter(Boolean).length;
  const engineTotal = Object.keys(apis).length;

  return (
    <div className="flex flex-col gap-5 pb-10">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">🏠 Command Center</h1>
          <p className="text-muted-foreground mt-1.5 text-sm">Real-time overview of your domain hunting engine and acquisition pipeline.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={toggleKill} disabled={togglingKill} className={`h-9 px-4 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${killActive?"bg-red-600 text-white hover:bg-red-700 shadow-lg shadow-red-900/20":"border border-border text-foreground hover:bg-muted/50"}`}>
            {killActive&&<span className="relative flex h-2 w-2"><span className="animate-ping absolute h-full w-full rounded-full bg-red-300 opacity-75"/><span className="rounded-full h-2 w-2 bg-white"/></span>}
            {killActive?"🛑 PAUSED":"⚡ Engine Active"}
          </button>
          <button onClick={triggerScan} disabled={scanning} className="h-9 px-4 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
            {scanning?<><span className="h-3.5 w-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Scanning…</>:"🔄 Run Scan Now"}
          </button>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {[
          { label:"Indexed Domains",val:stats.indexedDomains,icon:"🌐",c:"text-blue-400",bg:"bg-blue-500/10 border-blue-500/20" },
          { label:"Avg Score",val:stats.avgParasiteScore,icon:"📊",c:"text-purple-400",bg:"bg-purple-500/10 border-purple-500/20" },
          { label:"High Readiness",val:stats.highReadiness,icon:"🔥",c:"text-orange-400",bg:"bg-orange-500/10 border-orange-500/20" },
          { label:"Keywords Found",val:stats.keywordsIdentified,icon:"🔑",c:"text-green-400",bg:"bg-green-500/10 border-green-500/20" },
          { label:"Queue",val:status?.queue.pending??0,icon:"⏳",c:"text-yellow-400",bg:"bg-yellow-500/10 border-yellow-500/20" },
          { label:"Today Bought",val:dc,icon:"✅",c:"text-emerald-400",bg:"bg-emerald-500/10 border-emerald-500/20" },
        ].map(s=>(
          <div key={s.label} className={`rounded-xl border p-4 ${s.bg} hover:scale-[1.02] transition-transform cursor-default`}>
            <div className="flex justify-between items-start mb-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{s.label}</span>
              <span>{s.icon}</span>
            </div>
            <div className={`text-2xl font-bold ${s.c}`}>{s.val}</div>
          </div>
        ))}
      </div>

      {/* Row 2: Engine Status + Budget */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Engine Status */}
        <div className="lg:col-span-2 rounded-xl border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-sm">⚙️ Engine Status</h2>
            <div className="flex items-center gap-2">
              <div className={`h-2 w-2 rounded-full ${killActive?"bg-red-500 animate-pulse":"bg-green-500"}`}/>
              <span className="text-[10px] text-muted-foreground">{killActive?"Paused":"Running"}</span>
            </div>
          </div>

          {/* Sources */}
          <div className="flex flex-wrap gap-2">
            {[
              { k:"whoisfreaks",l:"Drop-Feed",a:apis.whoisfreaks },
              { k:"dataforseo",l:"Authority",a:apis.dataforseo },
              { k:"wayback",l:"TimeMachine",a:apis.wayback },
              { k:"googleIndex",l:"Index Check",a:apis.googleIndex },
            ].map(s=>(
              <span key={s.k} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold border ${s.a?"bg-green-500/10 text-green-400 border-green-500/20":"bg-red-500/10 text-red-400 border-red-500/20"}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${s.a?"bg-green-500":"bg-red-500"}`}/>{s.l}{s.a?" ✓":" ✗"}
              </span>
            ))}
            <span className="text-[10px] text-muted-foreground self-center ml-2">{engineOk}/{engineTotal} active</span>
          </div>

          {/* Last Scan / Last Purchase */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-muted/20 rounded-xl p-3">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Last Scan</div>
              <div className="font-bold mt-1">{timeAgo(status?.lastScan?.startedAt)}</div>
              {status?.lastScan && <div className="text-[10px] text-muted-foreground">{status.lastScan.domainsFound} domains found</div>}
            </div>
            <div className="bg-muted/20 rounded-xl p-3">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Last Purchase</div>
              {status?.lastPurchase?(
                <><div className="font-bold mt-1 font-mono text-sm truncate">{status.lastPurchase.domain}</div>
                <div className="text-[10px] text-muted-foreground">${status.lastPurchase.price??10} · {timeAgo(status.lastPurchase.boughtAt)}</div></>
              ):<div className="text-sm text-muted-foreground mt-1">None yet</div>}
            </div>
            <div className="bg-muted/20 rounded-xl p-3">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Pipeline</div>
              <div className="font-bold mt-1">{apis.whoisfreaks?"WhoisFreaks":"Not configured"}</div>
              <div className="text-[10px] text-muted-foreground">{apis.dataforseo?"DataForSEO scoring":"No scoring engine"}</div>
            </div>
          </div>

          {/* DataForSEO Warning */}
          {!apis.dataforseo && (
            <div className="text-xs text-yellow-400 bg-yellow-500/10 rounded-lg px-4 py-2.5 border border-yellow-500/20 flex items-center justify-between">
              <span>⚠️ DataForSEO not configured — domains saved without SEO scores</span>
              <a href="/settings" className="underline font-bold hover:text-yellow-300">Configure →</a>
            </div>
          )}
        </div>

        {/* Budget Card */}
        <div className="rounded-xl border bg-card p-5 space-y-4">
          <h2 className="font-semibold text-sm">💰 Daily Budget</h2>
          {[
            { label:"Purchases",val:dc,max:20,c:"bg-primary" },
            { label:"Spend",val:ds,max:50,c:ds/50>0.8?"bg-red-500":"bg-green-500",fmt:(v:number)=>`$${v.toFixed(0)}`,fmtMax:"$50" },
          ].map(b=>(
            <div key={b.label} className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">{b.label}</span>
                <span className="font-mono font-bold">{b.fmt?b.fmt(b.val):b.val} / {b.fmtMax??b.max}</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className={`h-full ${b.c} rounded-full transition-all`} style={{width:`${Math.min(100,(b.val/b.max)*100)}%`}}/>
              </div>
            </div>
          ))}
          <div className="bg-muted/20 rounded-xl p-3 text-center">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Remaining Budget</div>
            <div className="text-2xl font-bold text-green-400 mt-1">${(50-ds).toFixed(0)}</div>
            <div className="text-[10px] text-muted-foreground">{20-dc} purchases left today</div>
          </div>
        </div>
      </div>

      {/* Scan Progress */}
      <div className="rounded-xl border bg-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-sm">📡 Live Scan Progress</h2>
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${scan?.running?"bg-green-500 animate-pulse":"bg-muted-foreground"}`}/>
            <span className="text-[10px] text-muted-foreground">{scan?.running?"Running":"Idle"} · auto-refresh 5s</span>
          </div>
        </div>
        <div>
          <div className="flex justify-between text-xs mb-1.5">
            <span className="text-muted-foreground">Domains Processed</span>
            <span className="font-mono font-bold">{(scan?.processed??0).toLocaleString()} / {(scan?.total??0).toLocaleString()}</span>
          </div>
          <div className="h-3 bg-muted rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-500 ${scan?.running?"bg-primary":"bg-muted-foreground/50"}`} style={{width:`${scan?.total?(scan.processed/scan.total)*100:0}%`}}/>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label:"Pass Rate",val:`${scan?.passRate??"0.0"}%`,sub:`${scan?.passed??0} survived`,c:"text-green-400" },
            { label:"Speed",val:`${scan?.ratePerMin??0}/min`,sub:"domains/minute",c:"text-blue-400" },
            { label:"ETA",val:scan?.estimatedRemainingMs&&scan.estimatedRemainingMs>0?`${Math.ceil(scan.estimatedRemainingMs/60000)}m`:"—",sub:"remaining",c:"text-foreground" },
            { label:"Errors",val:String(scan?.failed??0),sub:"failed checks",c:(scan?.failed??0)>0?"text-red-400":"text-green-400" },
          ].map(s=>(
            <div key={s.label} className="bg-muted/20 rounded-xl p-3">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{s.label}</div>
              <div className={`text-lg font-bold mt-0.5 ${s.c}`}>{s.val}</div>
              <div className="text-[10px] text-muted-foreground">{s.sub}</div>
            </div>
          ))}
        </div>

        {/* Rate Limits */}
        {scan?.rateLimits && Object.keys(scan.rateLimits).length>0 && (
          <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide self-center mr-2">API Limits:</span>
            {Object.entries(scan.rateLimits).map(([api,rl])=>{
              const pct = rl.dayLimit?(rl.dayCount/rl.dayLimit)*100:0;
              return <span key={api} className={`text-[10px] font-mono px-2 py-1 rounded border ${pct>80?"bg-red-500/10 text-red-400 border-red-500/20":"bg-muted/30 border-border"}`}>{api}: {rl.remaining} left</span>;
            })}
          </div>
        )}
      </div>

      {/* Row 4: Top Opportunities + Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Top Opportunities */}
        <div className="rounded-xl border bg-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-sm">🔥 Top Opportunities</h2>
            <a href="/niche-intelligence" className="text-[10px] text-primary font-bold hover:underline">View All →</a>
          </div>
          {topNiches.length===0?<div className="text-sm text-muted-foreground py-4">Loading…</div>:
            topNiches.map(n=>(
              <div key={n.slug} className="flex items-center gap-3 bg-muted/20 rounded-xl px-4 py-3 hover:bg-muted/30 transition-colors cursor-pointer" onClick={()=>window.location.href=`/hunt?niche=${n.slug}&source=dashboard`}>
                <Ring score={n.opportunityScore??Math.round(n.parasiteSuccessRate*0.9)} size={38}/>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm">{n.displayName}</div>
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground mt-0.5">
                    <span className="text-green-400 font-bold">{n.parasiteSuccessRate}% success</span>
                    <span>{n.avgTimeToRank}d to rank</span>
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${n.opportunity==="HOT"?"bg-orange-500/20 text-orange-400":"bg-blue-500/20 text-blue-400"}`}>{n.opportunity}</span>
                  </div>
                </div>
                <span className="text-xs text-primary font-bold">Hunt →</span>
              </div>
            ))
          }
        </div>

        {/* Quick Actions */}
        <div className="rounded-xl border bg-card p-5 space-y-3">
          <h2 className="font-semibold text-sm">⚡ Quick Actions</h2>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label:"Run Full Scan",desc:"WhoisFreaks + DataForSEO pipeline",href:"#",icon:"🔄",action:triggerScan,disabled:scanning,bg:"bg-blue-600 hover:bg-blue-700 text-white" },
              { label:"Hunt Domains",desc:"Score & filter expired domains",href:"/hunt",icon:"🎯",bg:"bg-green-600 hover:bg-green-700 text-white" },
              { label:"Auctions",desc:"Live GoDaddy auction opportunities",href:"/auctions",icon:"🏷",bg:"bg-purple-600 hover:bg-purple-700 text-white" },
              { label:"IPTV Hunter",desc:"IPTV niche across 14 markets",href:"/iptv-hunter",icon:"📺",bg:"bg-indigo-600 hover:bg-indigo-700 text-white" },
              { label:"Spy",desc:"Analyze competitor portfolios",href:"/spy",icon:"🕵️",bg:"bg-orange-600 hover:bg-orange-700 text-white" },
              { label:"Settings",desc:"API keys & configuration",href:"/settings",icon:"⚙️",bg:"border border-border hover:bg-muted/50 text-foreground" },
            ].map(a=>(
              <button key={a.label} onClick={()=>a.action?a.action():window.location.href=a.href} disabled={a.disabled} className={`rounded-xl p-3 text-left transition-all hover:scale-[1.02] disabled:opacity-50 ${a.bg}`}>
                <div className="flex items-center gap-2 mb-1">
                  <span>{a.icon}</span>
                  <span className="font-bold text-xs">{a.label}</span>
                </div>
                <div className="text-[10px] opacity-70">{a.desc}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
