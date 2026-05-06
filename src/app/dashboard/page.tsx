"use client";
import React, { useState, useEffect, useCallback } from "react";

interface ScanRun { id:string; startedAt:string; endedAt:string; source:string; domainsScanned:number; domainsPassed:number; status:string; log:string[] }
interface TopDomain { id:string; name:string; niche:string; score:number; status:string; googleIndexed:boolean|null; createdAt:string }
interface Stats { total:number; queued:number; pending:number; rejected:number; bought:number; avgScore:number }

export default function DashboardPage() {
  const [scanning, setScanning] = useState(false);
  const [lastScan, setLastScan] = useState<ScanRun|null>(null);
  const [topDomains, setTopDomains] = useState<TopDomain[]>([]);
  const [stats, setStats] = useState<Stats>({ total:0, queued:0, pending:0, rejected:0, bought:0, avgScore:0 });
  const [apis, setApis] = useState({ whoisfreaks:false, dataforseo:false, namecheap:false });
  const [scanResult, setScanResult] = useState<Record<string, unknown>|null>(null);

  const fetchAll = useCallback(async () => {
    try {
      const [statsRes, domainsRes, settingsRes] = await Promise.all([
        fetch("/api/dashboard/stats").then(r=>r.json()).catch(()=>null),
        fetch("/api/domains?limit=10&sort=score").then(r=>r.json()).catch(()=>null),
        fetch("/api/settings").then(r=>r.json()).catch(()=>null),
      ]);
      if (statsRes?.data) {
        const d = statsRes.data;
        setStats({ total:d.total??0, queued:d.queued??0, pending:d.pending??0, rejected:d.rejected??0, bought:d.bought??0, avgScore:d.avgScore??0 });
      }
      if (domainsRes?.data) setTopDomains(domainsRes.data.slice(0,10));
      if (settingsRes?.data) {
        const s = settingsRes.data;
        setApis({
          whoisfreaks: !!(s.whoisfreaksApiKey),
          dataforseo: !!(s.dfs_email || s.dataForSeoEmail) && !!(s.dfs_password || s.dataForSeoPassword),
          namecheap: !!(s.nc_api_user || s.namecheapApiUser),
        });
      }
      // Last scan
      const scanRes = await fetch("/api/scan-runs?limit=1").then(r=>r.json()).catch(()=>null);
      if (scanRes?.data?.[0]) setLastScan(scanRes.data[0]);
    } catch {}
  }, []);

  useEffect(() => { fetchAll(); const id=setInterval(fetchAll,15000); return ()=>clearInterval(id); }, [fetchAll]);

  const triggerScan = async () => {
    setScanning(true); setScanResult(null);
    try {
      const r = await fetch('/api/cron/scan');
      const data = await r.json();
      setScanResult(data);
      if (data.success) await fetchAll();
    } catch(e) { setScanResult({ success:false, error:String(e) }); }
    finally { setScanning(false); }
  };

  return (
    <div className="flex flex-col gap-5 pb-10">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">🏠 Dashboard</h1>
          <p className="text-muted-foreground mt-1 text-sm">Aggregated Drop-Feed Pipeline — find expired domains with SEO value</p>
        </div>
        <button onClick={triggerScan} disabled={scanning} className="h-10 px-5 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2">
          {scanning ? <><span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Running Pipeline…</> : "🔍 Run Scan Now"}
        </button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label:"Total Found", val:stats.total, c:"text-foreground" },
          { label:"Queued (≥60)", val:stats.queued, c:"text-green-400" },
          { label:"Pending", val:stats.pending, c:"text-yellow-400" },
          { label:"Rejected", val:stats.rejected, c:"text-red-400" },
          { label:"Bought", val:stats.bought, c:"text-blue-400" },
          { label:"Avg Score", val:stats.avgScore, c:"text-purple-400" },
        ].map(s=>(
          <div key={s.label} className="rounded-xl border bg-card p-3 text-center">
            <div className={`text-2xl font-bold ${s.c}`}>{s.val}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Engine Status */}
      <div className="rounded-xl border bg-card p-4">
        <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Engine Status</div>
        <div className="flex flex-wrap gap-2">
          {[
            { l:"Drop-Feed", a:apis.whoisfreaks, desc:"WhoisFreaks" },
            { l:"Authority", a:apis.dataforseo, desc:"DataForSEO" },
            { l:"TimeMachine", a:true, desc:"Wayback (FREE)" },
            { l:"Index Check", a:apis.dataforseo, desc:"DataForSEO SERP" },
            { l:"Verify", a:apis.namecheap, desc:"Namecheap" },
          ].map(s=>(
            <span key={s.l} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold border ${s.a?"bg-green-500/10 text-green-400 border-green-500/20":"bg-red-500/10 text-red-400 border-red-500/20"}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${s.a?"bg-green-500":"bg-red-500"}`}/>
              {s.l} {s.a?"✓":"✗"}
              <span className="font-normal text-muted-foreground ml-1">({s.desc})</span>
            </span>
          ))}
        </div>
        {!apis.whoisfreaks && <div className="mt-3 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">⚠ WhoisFreaks API key not configured — <a href="/settings" className="underline font-bold">Configure →</a></div>}
      </div>

      {/* Scan Result (after clicking Run Scan) */}
      {scanResult && (
        <div className={`rounded-xl border p-4 ${(scanResult as {success?:boolean}).success ? "bg-green-500/5 border-green-500/20" : "bg-red-500/5 border-red-500/20"}`}>
          <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
            {(scanResult as {success?:boolean}).success ? "✅ Pipeline Complete" : "❌ Pipeline Failed"}
          </div>
          {(scanResult as {success?:boolean}).success ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              {[
                { l:"Total Drops", v:(scanResult as Record<string,number>).totalDrops?.toLocaleString() },
                { l:"Niche Matches", v:(scanResult as Record<string,number>).nicheMatches },
                { l:"Available", v:(scanResult as Record<string,number>).available },
                { l:"Scored", v:(scanResult as Record<string,number>).scored },
                { l:"Clean History", v:(scanResult as Record<string,number>).cleanHistory },
                { l:"Google Indexed", v:(scanResult as Record<string,number>).googleIndexed },
                { l:"Queued (≥60)", v:(scanResult as Record<string,number>).queued },
                { l:"Saved", v:(scanResult as Record<string,number>).domainsSaved },
              ].map(i=>(
                <div key={i.l} className="bg-card border rounded-lg px-3 py-2">
                  <div className="text-muted-foreground">{i.l}</div>
                  <div className="font-bold text-foreground text-sm">{i.v ?? 0}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-xs text-red-400 font-mono">{(scanResult as {error?:string}).error || "Unknown error"}</div>
          )}
          {(scanResult as {topFinds?:{domain:string;score:number}[]}).topFinds?.length ? (
            <div className="mt-3 text-xs">
              <span className="font-bold">🏆 Top: </span>
              {(scanResult as {topFinds:{domain:string;score:number}[]}).topFinds.slice(0,3).map((f,i) => (
                <span key={i} className="inline-flex items-center gap-1 mr-3">
                  <span className="font-mono font-bold">{f.domain}</span>
                  <span className="text-green-400">({f.score}pts)</span>
                </span>
              ))}
            </div>
          ) : null}
        </div>
      )}

      {/* Last Scan Info */}
      {lastScan && (
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Last Scan</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${lastScan.status==="COMPLETED"?"bg-green-500/10 text-green-400":"bg-yellow-500/10 text-yellow-400"}`}>{lastScan.status}</span>
          </div>
          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
            <span>📅 {new Date(lastScan.endedAt).toLocaleString()}</span>
            <span>📊 {lastScan.domainsScanned.toLocaleString()} scanned</span>
            <span>💾 {lastScan.domainsPassed} saved</span>
            <span>⚙️ {lastScan.source}</span>
          </div>
          {lastScan.log?.length > 0 && (
            <details className="mt-3">
              <summary className="text-[10px] text-muted-foreground cursor-pointer hover:text-foreground">Show log ({lastScan.log.length} entries)</summary>
              <div className="mt-2 max-h-40 overflow-y-auto space-y-0.5">
                {lastScan.log.map((l,i) => <div key={i} className="text-[10px] font-mono text-muted-foreground">{l}</div>)}
              </div>
            </details>
          )}
        </div>
      )}

      {/* Top Domains Table */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="px-5 py-3.5 border-b flex items-center justify-between">
          <h2 className="font-semibold text-sm">Top Domains Found</h2>
          <a href="/domains" className="text-xs text-primary hover:underline font-medium">View All →</a>
        </div>
        {topDomains.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <div className="text-3xl mb-2">🎯</div>
            <div className="text-sm font-medium">No domains found yet</div>
            <div className="text-xs mt-1">Click &quot;Run Scan Now&quot; to start the pipeline</div>
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead><tr className="border-b text-muted-foreground">
              <th className="text-left px-4 py-2 font-medium">Domain</th>
              <th className="text-left px-4 py-2 font-medium">Niche</th>
              <th className="text-center px-4 py-2 font-medium">Score</th>
              <th className="text-center px-4 py-2 font-medium">Indexed</th>
              <th className="text-center px-4 py-2 font-medium">Status</th>
            </tr></thead>
            <tbody>
              {topDomains.map(d => (
                <tr key={d.id} className="border-b last:border-0 hover:bg-muted/20">
                  <td className="px-4 py-2.5 font-mono font-bold">{d.name}</td>
                  <td className="px-4 py-2.5"><span className="px-2 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-semibold">{d.niche?.replace(/_/g," ")||"—"}</span></td>
                  <td className="px-4 py-2.5 text-center"><span className={`font-bold ${(d.score??0)>=60?"text-green-400":(d.score??0)>=40?"text-yellow-400":"text-red-400"}`}>{d.score??0}</span></td>
                  <td className="px-4 py-2.5 text-center">{d.googleIndexed===true?"✅":"❌"}</td>
                  <td className="px-4 py-2.5 text-center"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${d.status==="QUEUED"?"bg-green-500/10 text-green-400":d.status==="BOUGHT"?"bg-blue-500/10 text-blue-400":d.status==="REJECTED"?"bg-red-500/10 text-red-400":"bg-yellow-500/10 text-yellow-400"}`}>{d.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
