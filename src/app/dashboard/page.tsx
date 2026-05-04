"use client";

import { useEffect, useState, useCallback } from "react";

interface DashboardStatus {
  lastScan: { startedAt: string; domainsFound: number; status: string } | null;
  lastPurchase: { domain: string; price: number | null; boughtAt: string | null } | null;
  queue: { pending: number; dailyCount: number; dailySpend: number; killSwitchActive: boolean };
}

interface ScanProgress {
  running: boolean;
  processed: number;
  total: number;
  passed: number;
  failed: number;
  passRate: string;
  ratePerMin: number;
  estimatedRemainingMs: number;
  sourcesActive: Record<string, boolean>;
  rateLimits: Record<string, { remaining: number; dayCount: number; dayLimit?: number }>;
}

function timeAgo(dateStr: string | null | undefined): string {
  if (!dateStr) return "Never";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);
  if (days > 0) return `${days}d ago`;
  if (hrs > 0) return `${hrs}h ago`;
  if (mins > 0) return `${mins}m ago`;
  return "Just now";
}

function formatMs(ms: number): string {
  if (ms <= 0) return "—";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function ProgressBar({ value, total, color = "bg-primary" }: { value: number; total: number; color?: string }) {
  const pct = total > 0 ? Math.min(100, (value / total) * 100) : 0;
  const filled = Math.round(pct / 5);
  const empty = 20 - filled;
  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-xs text-muted-foreground">
        {"█".repeat(filled)}{"░".repeat(empty)}
      </span>
      <div className={`h-1.5 flex-1 bg-muted rounded-full overflow-hidden hidden sm:block`}>
        <div className={`h-full ${color} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState({ 
    indexedDomains: 0, 
    avgParasiteScore: 0, 
    highReadiness: 0, 
    keywordsIdentified: 0,
    whoisdsStatus: { lastDownload: null, domainsLoaded: 0, nextRetry: null }
  });
  const [status, setStatus] = useState<DashboardStatus | null>(null);
  const [scanProgress, setScanProgress] = useState<ScanProgress | null>(null);
  const [killActive, setKillActive] = useState(false);
  const [togglingKill, setTogglingKill] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [topNiches, setTopNiches] = useState<Array<{displayName:string;parasiteSuccessRate:number;avgTimeToRank:number;opportunity:string;slug:string}>>([]);
  const [apiConfigured, setApiConfigured] = useState({ whoisfreaks: true, dataforseo: false, googleIndex: false, wayback: true });

  const fetchAll = useCallback(async () => {
    const [statsRes, statusRes] = await Promise.allSettled([
      fetch("/api/dashboard/stats").then(r => r.json()),
      fetch("/api/dashboard/status").then(r => r.json()),
    ]);
    if (statsRes.status === "fulfilled" && !statsRes.value.error) setStats(statsRes.value);
    if (statusRes.status === "fulfilled" && !statusRes.value.error) {
      setStatus(statusRes.value);
      setKillActive(statusRes.value.queue?.killSwitchActive ?? false);
    }
  }, []);

  const fetchProgress = useCallback(async () => {
    try {
      const res = await fetch("/api/scan/progress");
      if (res.ok) setScanProgress(await res.json());
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchAll();
    fetchProgress();
    const interval = setInterval(fetchAll, 30000);
    const progressInterval = setInterval(fetchProgress, 5000);
    return () => { clearInterval(interval); clearInterval(progressInterval); };
  }, [fetchAll, fetchProgress]);

  useEffect(() => {
    fetch('/api/niche-intelligence').then(r => r.json()).then(j => {
      if (j.niches) setTopNiches(j.niches.filter((n: {opportunity:string}) => n.opportunity === 'HOT').slice(0, 3));
    }).catch(() => {});
  }, []);

  // Check which APIs are configured in settings
  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(j => {
      if (j.data) {
        const d = j.data;
        setApiConfigured({
          whoisfreaks: !!(d.whoisfreaksApiKey),
          dataforseo:  !!(d.dfs_email || d.dataForSeoEmail) && !!(d.dfs_password || d.dataForSeoPassword),
          googleIndex: !!(d.google_sa_key),
          wayback:     true, // Wayback is always free / always active
        });
      }
    }).catch(() => {});
  }, []);

  const toggleKillSwitch = async () => {
    setTogglingKill(true);
    try {
      const res = await fetch("/api/purchase/killswitch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !killActive }),
      });
      if (res.ok) { setKillActive(!killActive); await fetchAll(); }
    } finally { setTogglingKill(false); }
  };

  async function triggerManualScan() {
    setScanning(true);
    try {
      const res = await fetch('/api/cron/scan', {
        headers: { 
          'x-cron-secret': process.env.NEXT_PUBLIC_CRON_SECRET || 'change-me-random-string-32chars' 
        }
      });
      const data = await res.json();
      if (!data.success || !res.ok) {
        const errorMsg = data.log?.join('\n') || data.error || 'Unknown error';
        alert(`Scan failed:\n${errorMsg}`);
      } else {
        alert(`Scan complete — ${data.domainsFound || 0} domains found, ${data.domainsSaved || 0} saved`);
        await fetchAll();
      }
    } catch (e) {
      alert(`Scan failed: ${String(e)}`);
    } finally {
      setScanning(false);
    }
  }

  const dailyLimit = 20;
  const dailyBudget = 50;
  const dailyCount = status?.queue.dailyCount ?? 0;
  const dailySpend = status?.queue.dailySpend ?? 0;


  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-2">Overview of your domain hunting engine and acquisition metrics.</p>
      </div>

      {/* HUD Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Indexed Domains", value: stats.indexedDomains, sub: "Passed Google Index Check", icon: "M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6", color: "text-blue-500" },
          { label: "Avg Parasite Score", value: stats.avgParasiteScore, sub: "Topical Authority + Index", icon: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M12 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8z", color: "text-purple-500" },
          { label: "High Readiness", value: stats.highReadiness, sub: "Score >= 70, Ready to rank", icon: "M2 10h20M2 5h20M2 15h20M2 20h20", color: "text-green-500" },
          { label: "Keywords Identified", value: stats.keywordsIdentified, sub: "From historical rankings", icon: "M22 12h-4l-3 9L9 3l-3 9H2", color: "text-orange-500" },
        ].map(card => (
          <div key={card.label} className="rounded-xl border bg-card text-card-foreground shadow-sm p-6">
            <div className="flex flex-row items-center justify-between pb-2">
              <h3 className="tracking-tight text-sm font-medium">{card.label}</h3>
              <svg className="h-4 w-4 text-muted-foreground" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d={card.icon} />
              </svg>
            </div>
            <div className={`text-2xl font-bold ${card.color}`}>{card.value}</div>
            <p className="text-xs text-muted-foreground">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* System Status Panel */}
      <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-semibold text-lg">System Status</h3>
          <div className="flex items-center gap-3">
            <button
              onClick={toggleKillSwitch}
              disabled={togglingKill}
              className={`relative inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                killActive ? "bg-red-500 text-white hover:bg-red-600" : "bg-muted text-foreground hover:bg-muted/80"
              }`}
            >
              {killActive && (
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
                </span>
              )}
              {killActive ? "🛑 HUNTING PAUSED" : "⚡ Kill Switch Off"}
            </button>
            <button
              onClick={triggerManualScan}
              disabled={scanning}
              className="px-4 py-2 rounded-lg text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              {scanning ? (
                <>
                  <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Scanning...
                </>
              ) : "🔄 Run Scan Now"}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between text-sm border-b border-border pb-3">
              <span className="text-muted-foreground">Last Scan</span>
              <div className="text-right">
                <div className="font-medium">{timeAgo(status?.lastScan?.startedAt)}</div>
                {status?.lastScan && <div className="text-xs text-muted-foreground">{status.lastScan.domainsFound ?? 0} domains found</div>}
              </div>
            </div>
            <div className="flex items-center justify-between text-sm border-b border-border pb-3">
              <span className="text-muted-foreground">Queue</span>
              <div className="font-medium">{status?.queue.pending ?? 0} domains waiting</div>
            </div>
            <div className="flex items-center justify-between text-sm border-b border-border pb-3">
              <span className="text-muted-foreground">Last Purchase</span>
              <div className="text-right">
                {status?.lastPurchase ? (
                  <>
                    <div className="font-medium">{status.lastPurchase.domain}</div>
                    <div className="text-xs text-muted-foreground">${status.lastPurchase.price ?? 10} · {timeAgo(status.lastPurchase.boughtAt)}</div>
                  </>
                ) : <span className="text-muted-foreground">None yet</span>}
              </div>
            </div>
          </div>

          <div className="space-y-5">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-muted-foreground">Daily Purchases</span>
                <span className="font-semibold">{dailyCount} / {dailyLimit}</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${Math.min(100, (dailyCount / dailyLimit) * 100)}%` }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-muted-foreground">Daily Spend</span>
                <span className="font-semibold">${dailySpend.toFixed(0)} / ${dailyBudget}</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all ${dailySpend / dailyBudget > 0.8 ? "bg-red-500" : "bg-green-500"}`} style={{ width: `${Math.min(100, (dailySpend / dailyBudget) * 100)}%` }} />
              </div>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <div className={`h-2 w-2 rounded-full ${killActive ? "bg-red-500 animate-pulse" : "bg-green-500"}`} />
              <span className="text-sm text-muted-foreground">{killActive ? "All purchases paused" : "Engine running"}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Scan Progress Widget */}
      <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold text-lg">Current Scan Progress</h3>
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${scanProgress?.running ? "bg-green-500 animate-pulse" : "bg-muted-foreground"}`} />
            <span className="text-xs text-muted-foreground">{scanProgress?.running ? "Running" : "Idle"} · updates every 5s</span>
          </div>
        </div>

        <div className="space-y-4">
          {/* Main progress bar */}
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-muted-foreground font-medium">Domains Processed</span>
              <span className="font-mono font-bold">
                {(scanProgress?.processed ?? 0).toLocaleString()} / {(scanProgress?.total ?? 50000).toLocaleString()}
              </span>
            </div>
            <ProgressBar
              value={scanProgress?.processed ?? 0}
              total={scanProgress?.total ?? 50000}
              color={scanProgress?.running ? "bg-primary" : "bg-muted-foreground"}
            />
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Pass Rate", value: `${scanProgress?.passRate ?? "0.0"}%`, sub: `${(scanProgress?.passed ?? 0)} survived` },
              { label: "Scoring Rate", value: `${scanProgress?.ratePerMin ?? 0}/min`, sub: "domains/minute" },
              { label: "Est. Completion", value: formatMs(scanProgress?.estimatedRemainingMs ?? 0), sub: "remaining" },
              { label: "Failed", value: String(scanProgress?.failed ?? 0), sub: "errors" },
            ].map(s => (
              <div key={s.label} className="rounded-lg bg-muted/40 p-3">
                <div className="text-xs text-muted-foreground">{s.label}</div>
                <div className="text-lg font-bold mt-0.5">{s.value}</div>
                <div className="text-xs text-muted-foreground">{s.sub}</div>
              </div>
            ))}
          </div>

          {/* Sources Active */}
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Sources Active</div>
            <div className="flex flex-wrap gap-2 items-center">
              {[
                { key: 'whoisfreaks',  label: 'WhoisFreaks',  active: apiConfigured.whoisfreaks,  tip: 'Dropped domain feed — requires API key' },
                { key: 'dataforseo',   label: 'DataForSEO',   active: apiConfigured.dataforseo,   tip: 'SEO scoring — requires email + password' },
                { key: 'googleIndex',  label: 'Google Index', active: apiConfigured.googleIndex,  tip: 'Index check — requires Google SA key' },
                { key: 'wayback',      label: 'Wayback',      active: apiConfigured.wayback,      tip: 'Historical analysis — always active' },
              ].map(src => (
                <span
                  key={src.key}
                  title={src.tip}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${
                    src.active
                      ? 'bg-green-500/15 text-green-400 border-green-500/30'
                      : 'bg-red-500/10 text-red-400 border-red-500/20'
                  }`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${src.active ? 'bg-green-500' : 'bg-red-500'}`} />
                  {src.label} {src.active ? '✅' : '❌'}
                </span>
              ))}
            </div>
            {status?.lastScan && (
              <div className="text-xs text-muted-foreground mt-2">
                Last scan: {timeAgo(status.lastScan.startedAt)} · {status.lastScan.domainsFound ?? 0} domains found
              </div>
            )}
          </div>

          {/* WhoisFreaks Status Panel */}
          <div className="rounded-lg bg-muted/20 p-4 border border-muted-foreground/10">
            <div className="text-sm font-bold text-primary mb-3 uppercase tracking-wider flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${apiConfigured.whoisfreaks ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
              WhoisFreaks + DataForSEO Pipeline
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Pipeline Source</div>
                <div className="text-sm font-mono font-bold text-green-400">WhoisFreaks Drops</div>
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Scoring Engine</div>
                <div className={`text-sm font-mono font-bold ${apiConfigured.dataforseo ? 'text-green-400' : 'text-yellow-400'}`}>
                  {apiConfigured.dataforseo ? 'DataForSEO Active' : 'DataForSEO — Not configured'}
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Last Scan</div>
                <div className="text-sm font-mono font-bold">
                  {status?.lastScan ? timeAgo(status.lastScan.startedAt) : 'Never'}
                </div>
              </div>
            </div>
            {!apiConfigured.dataforseo && (
              <div className="mt-3 text-xs text-yellow-400 bg-yellow-500/10 rounded p-2 border border-yellow-500/20">
                ⚠️ DataForSEO not configured — domains will be saved without SEO scores.
                <a href="/settings" className="underline ml-1 font-semibold">Configure in Settings →</a>
              </div>
            )}
          </div>

          {/* Rate limit status */}
          {scanProgress?.rateLimits && Object.keys(scanProgress.rateLimits).length > 0 && (
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">API Rate Limits</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                {Object.entries(scanProgress.rateLimits).map(([api, rl]) => {
                  const pct = rl.dayLimit ? (rl.dayCount / rl.dayLimit) * 100 : 0;
                  const isHot = pct > 80;
                  return (
                    <div key={api} className={`rounded-lg p-2 border ${isHot ? "border-red-500/30 bg-red-500/10" : "bg-muted/30 border-border"}`}>
                      <div className="text-xs font-mono font-medium">{api}</div>
                      <div className={`text-sm font-bold ${isHot ? "text-red-500" : ""}`}>
                        {rl.remaining} left
                      </div>
                      {rl.dayLimit && (
                        <div className="text-xs text-muted-foreground">{rl.dayCount}/{rl.dayLimit} today</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Intelligence Widget */}
      <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-lg flex items-center gap-2">🧠 Top Opportunities Right Now</h3>
          <a href="/niche-intelligence" className="text-xs text-primary hover:underline">View Full Intelligence →</a>
        </div>
        <div className="space-y-2">
          {topNiches.length === 0 ? (
            <div className="text-sm text-muted-foreground">Loading intelligence data...</div>
          ) : topNiches.map(n => (
            <div key={n.slug} className="flex items-center justify-between rounded-lg bg-muted/30 px-4 py-2.5">
              <div className="flex items-center gap-2">
                <span className="text-base">🔥</span>
                <span className="font-medium text-sm">{n.displayName}</span>
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="text-green-400 font-semibold">{n.parasiteSuccessRate}% success</span>
                <span>{n.avgTimeToRank} days avg</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* IPTV Hunter Widget */}
      <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-6 border-blue-500/20 bg-gradient-to-br from-card to-blue-500/5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg flex items-center gap-2">📺 IPTV HUNTER STATUS</h3>
          <a href="/iptv-hunter" className="text-xs text-primary hover:underline font-bold bg-blue-500/10 px-3 py-1 rounded-full text-blue-400">Open IPTV Hunter →</a>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 text-sm border-b border-border/50 pb-4">
          <div>
            <div className="text-muted-foreground text-xs mb-1">Markets monitored</div>
            <div className="text-lg">🇺🇸 🇬🇧 🇫🇷 🇩🇪 🇳🇱 🇸🇪 🇳🇴 🇩🇰</div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs mb-1">IPTV domains found today</div>
            <div className="font-mono font-bold text-2xl text-green-400">0</div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs mb-1">Best opportunity</div>
            <div className="font-mono text-muted-foreground mt-1">—</div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs mb-1">Last IPTV scan</div>
            <div className="font-mono text-muted-foreground mt-1">Never</div>
          </div>
        </div>
        
        <div className="flex items-center justify-between mt-4">
          <div className="text-sm font-medium">Top IPTV Opportunities Right Now:</div>
        </div>
        <div className="text-sm text-muted-foreground mt-2 italic bg-muted/30 p-3 rounded-lg border border-border/50 text-center">
          No data yet — run first scan in the IPTV Hunter.
        </div>
        <button onClick={() => window.location.href='/iptv-hunter'} className="mt-4 w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold transition-colors shadow-lg shadow-blue-900/20">
          Run IPTV Scan →
        </button>
      </div>
    </div>
  );
}
