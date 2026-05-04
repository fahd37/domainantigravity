"use client";
import { useState } from "react";

interface ScoredDomain { domain: string; score: number; recommendation: string; waybackPages: number; lastArchived: string | null; matchedNiche: string | null; }
interface WinningPattern { topTLDs: { tld: string; count: number }[]; keywordLengths: { length: number; label: string; count: number }[]; topKeywords: string[]; avgDomainAge: number; avgReferringDomains: number; avgScore: number; totalAnalyzed: number; highValueCount: number; }
interface SpyResult { id?: string; competitorDomain: string; isTwitter: boolean; domains: ScoredDomain[]; totalDiscovered: number; patterns: WinningPattern; }

const STEPS = ["🌐 Fetching domain portfolio…", "🔍 Checking Wayback Machine…", "📊 Scoring domains…", "🧠 Extracting patterns…", "✅ Analysis complete!"];
const PRESETS = [{ label: "Moz", val: "moz.com" }, { label: "Ahrefs", val: "ahrefs.com" }, { label: "SEMrush", val: "semrush.com" }, { label: "Backlinko", val: "backlinko.com" }, { label: "NeilPatel", val: "neilpatel.com" }];
const TLD_COLORS = ["#6366f1","#22c55e","#f59e0b","#ef4444","#8b5cf6","#06b6d4","#f43f5e","#84cc16"];

function ScoreRing({ score }: { score: number }) {
  const c = score >= 55 ? "#22c55e" : score >= 35 ? "#eab308" : "#ef4444";
  const r = 14, circ = 2 * Math.PI * r, dash = (score / 100) * circ;
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" className="flex-shrink-0">
      <circle cx="18" cy="18" r={r} fill="none" stroke="currentColor" strokeWidth="2.5" className="text-muted/40"/>
      <circle cx="18" cy="18" r={r} fill="none" stroke={c} strokeWidth="2.5" strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" transform="rotate(-90 18 18)"/>
      <text x="18" y="18" textAnchor="middle" dominantBaseline="central" fill={c} fontSize="8" fontWeight="bold">{score}</text>
    </svg>
  );
}

function TLDBar({ data }: { data: { tld: string; count: number }[] }) {
  const total = data.reduce((s, d) => s + d.count, 0) || 1;
  return (
    <div className="space-y-2">
      {data.slice(0, 6).map((d, i) => (
        <div key={d.tld} className="flex items-center gap-2">
          <span className="text-xs font-mono w-12 text-right">{d.tld}</span>
          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${(d.count / total) * 100}%`, background: TLD_COLORS[i % TLD_COLORS.length] }} />
          </div>
          <span className="text-[10px] text-muted-foreground w-8 text-right">{Math.round((d.count / total) * 100)}%</span>
        </div>
      ))}
    </div>
  );
}

function RecBadge({ rec }: { rec: string }) {
  const map: Record<string, string> = { buy: "bg-green-500/20 text-green-400 border-green-500/30", watch: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30", skip: "bg-muted text-muted-foreground border-border", reject: "bg-red-500/20 text-red-400 border-red-500/30" };
  return <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${map[rec] ?? map.skip}`}>{rec.toUpperCase()}</span>;
}

export default function SpyPage() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0);
  const [result, setResult] = useState<SpyResult | null>(null);
  const [error, setError] = useState("");
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState(false);
  const [activeTab, setActiveTab] = useState<"portfolio"|"patterns"|"actions">("portfolio");

  const analyze = async (val?: string) => {
    const target = (val ?? input).trim();
    if (!target) return;
    if (val) setInput(val);
    setLoading(true); setResult(null); setError(""); setImported(false); setStep(0);
    const iv = setInterval(() => setStep(p => Math.min(p + 1, STEPS.length - 2)), 3500);
    try {
      const res = await fetch("/api/spy/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ input: target }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Analysis failed");
      setStep(STEPS.length - 1);
      setResult(data);
      setActiveTab("portfolio");
    } catch (e) { setError(e instanceof Error ? e.message : "Analysis failed"); }
    finally { clearInterval(iv); setLoading(false); }
  };

  const importNiche = async () => {
    if (!result?.id) return;
    setImporting(true);
    try {
      const res = await fetch("/api/spy/history", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "import-niche", analysisId: result.id, competitorDomain: result.competitorDomain }) });
      const d = await res.json();
      if (d.success) setImported(true); else alert(d.error || "Import failed");
    } finally { setImporting(false); }
  };

  const huntNow = () => {
    if (!result) return;
    sessionStorage.setItem("spy_hunt_domains", result.domains.map(d => d.domain).join("\n"));
    window.location.href = "/hunt";
  };

  const buyCount = result?.domains.filter(d => d.recommendation === "buy").length ?? 0;
  const watchCount = result?.domains.filter(d => d.recommendation === "watch").length ?? 0;
  const avgScore = result ? Math.round(result.patterns.avgScore) : 0;

  return (
    <div className="flex flex-col gap-5 pb-10">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          🕵️ Competitor Spy
        </h1>
        <p className="text-muted-foreground mt-1.5 text-sm">Reverse-engineer any competitor's domain portfolio and extract their winning SEO patterns.</p>
      </div>

      {/* Search */}
      <div className="rounded-xl border bg-card shadow-sm p-5 space-y-4">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">🔍</span>
            <input
              className="w-full h-11 rounded-lg border border-input bg-transparent pl-9 pr-4 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              placeholder="Enter competitor domain — e.g. moz.com, ahrefs.com, or @twitter_handle"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && analyze()}
            />
          </div>
          <button
            onClick={() => analyze()}
            disabled={loading || !input.trim()}
            className="h-11 px-6 rounded-lg bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2 transition-colors"
          >
            {loading ? <><span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Analyzing…</> : "Analyze →"}
          </button>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] text-muted-foreground uppercase font-semibold tracking-widest">Quick targets:</span>
          {PRESETS.map(p => (
            <button key={p.val} onClick={() => analyze(p.val)} disabled={loading} className="px-3 py-1 text-xs rounded-full border border-border hover:bg-muted/50 hover:border-primary/50 transition-colors font-medium disabled:opacity-40">
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="rounded-xl border bg-card shadow-sm p-8">
          <div className="max-w-md mx-auto space-y-4">
            <div className="text-center mb-6">
              <div className="text-2xl mb-2">🕵️</div>
              <div className="font-semibold">Analysing <span className="text-primary font-mono">{input}</span></div>
              <div className="text-xs text-muted-foreground mt-1">Running full competitor intelligence pipeline</div>
            </div>
            {STEPS.map((s, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className={`h-6 w-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs transition-all duration-500 ${i < step ? "bg-green-500 text-white" : i === step ? "bg-primary text-primary-foreground animate-pulse" : "bg-muted text-muted-foreground"}`}>
                  {i < step ? "✓" : i + 1}
                </div>
                <span className={`text-sm transition-colors ${i === step ? "text-foreground font-semibold" : i < step ? "text-muted-foreground line-through" : "text-muted-foreground"}`}>{s}</span>
                {i === step && <div className="flex gap-0.5">{[0,1,2].map(d => <div key={d} className="h-1 w-1 rounded-full bg-primary animate-bounce" style={{ animationDelay: `${d * 0.15}s` }}/>)}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error */}
      {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400 flex items-center gap-2"><span>❌</span>{error}</div>}

      {/* Results */}
      {result && (
        <>
          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Domains Found", val: result.totalDiscovered, icon: "🌐", c: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
              { label: "🟢 Buy Signals", val: buyCount, icon: "💰", c: "text-green-400", bg: "bg-green-500/10 border-green-500/20" },
              { label: "👁 Watch", val: watchCount, icon: "👀", c: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/20" },
              { label: "Avg Score", val: `${avgScore}/100`, icon: "📊", c: "text-purple-400", bg: "bg-purple-500/10 border-purple-500/20" },
            ].map(s => (
              <div key={s.label} className={`rounded-xl border p-4 ${s.bg}`}>
                <div className="flex justify-between items-start mb-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{s.label}</span>
                  <span>{s.icon}</span>
                </div>
                <div className={`text-2xl font-bold ${s.c}`}>{s.val}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">{result.isTwitter ? "from Twitter" : result.competitorDomain}</div>
              </div>
            ))}
          </div>

          {/* Competitor Banner */}
          <div className="rounded-xl border border-primary/20 bg-primary/5 px-5 py-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{result.isTwitter ? "🐦" : "🌐"}</span>
              <div>
                <div className="font-bold">{result.competitorDomain}</div>
                <div className="text-xs text-muted-foreground">{result.totalDiscovered} domains discovered · {result.domains.length} scored · {result.patterns.topKeywords.length} keyword patterns</div>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={huntNow} disabled={result.domains.length === 0} className="h-8 px-4 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 disabled:opacity-50">🎯 Hunt Now</button>
              <button onClick={importNiche} disabled={importing || imported || result.patterns.topKeywords.length === 0} className="h-8 px-4 rounded-lg border border-border text-xs font-bold hover:bg-muted/50 disabled:opacity-50">
                {imported ? "✅ Imported!" : importing ? "…" : "📥 Import Niche"}
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 border-b border-border">
            {[
              { k: "portfolio", label: `📋 Portfolio (${result.domains.length})` },
              { k: "patterns", label: "🧠 Patterns" },
              { k: "actions", label: "⚡ Actions" },
            ].map(t => (
              <button key={t.k} onClick={() => setActiveTab(t.k as typeof activeTab)} className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === t.k ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Tab: Portfolio */}
          {activeTab === "portfolio" && (
            <div className="rounded-xl border bg-card overflow-hidden">
              <div className="px-5 py-3.5 border-b flex items-center justify-between">
                <h2 className="font-semibold text-sm">Discovered & Scored Domains</h2>
                <span className="text-xs text-muted-foreground">{result.domains.length} analysed · {result.totalDiscovered} total</span>
              </div>
              {result.domains.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground"><div className="text-3xl mb-3">🔍</div>No domains found. Try a different competitor or check your DataForSEO credentials.</div>
              ) : (
                <div className="divide-y divide-border">
                  {result.domains.map((d, i) => (
                    <div key={i} className="px-5 py-3.5 flex items-center gap-4 hover:bg-muted/20 transition-colors">
                      <ScoreRing score={d.score} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-semibold text-sm">{d.domain}</span>
                          <RecBadge rec={d.recommendation} />
                          {d.matchedNiche && <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-primary/10 text-primary">{d.matchedNiche}</span>}
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-[11px] text-muted-foreground">
                          <span>📚 {d.waybackPages} snapshots</span>
                          {d.lastArchived && <span>Last: {new Date(d.lastArchived).toLocaleDateString()}</span>}
                        </div>
                      </div>
                      <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden flex-shrink-0">
                        <div className={`h-full rounded-full ${d.score >= 55 ? "bg-green-500" : d.score >= 35 ? "bg-yellow-500" : "bg-red-500"}`} style={{ width: `${d.score}%` }} />
                      </div>
                      <div className="flex gap-1.5 flex-shrink-0">
                        <a href={`https://web.archive.org/web/*/${d.domain}`} target="_blank" rel="noopener noreferrer" className="h-7 px-2 rounded border border-border text-[10px] font-medium hover:bg-muted/50 flex items-center">Archive</a>
                        <button onClick={() => { sessionStorage.setItem("spy_hunt_domains", d.domain); window.location.href = "/hunt"; }} className="h-7 px-2 rounded bg-primary/15 text-primary text-[10px] font-bold hover:bg-primary/25">Hunt →</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab: Patterns */}
          {activeTab === "patterns" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* TLD Distribution */}
              <div className="rounded-xl border bg-card p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm">TLD Distribution</h3>
                  <span className="text-xs text-muted-foreground">{result.patterns.topTLDs.length} TLDs</span>
                </div>
                {result.patterns.topTLDs.length > 0 ? <TLDBar data={result.patterns.topTLDs} /> : <p className="text-xs text-muted-foreground">Not enough data</p>}
              </div>

              {/* Keyword Length */}
              <div className="rounded-xl border bg-card p-5 space-y-4">
                <h3 className="font-semibold text-sm">Domain Name Length</h3>
                <div className="space-y-2">
                  {result.patterns.keywordLengths.map(kl => {
                    const max = Math.max(...result.patterns.keywordLengths.map(k => k.count), 1);
                    return (
                      <div key={kl.length} className="flex items-center gap-2">
                        <span className="text-[11px] w-20 text-muted-foreground">{kl.label}</span>
                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full transition-all duration-700" style={{ width: `${(kl.count / max) * 100}%` }} />
                        </div>
                        <span className="text-[10px] font-mono text-muted-foreground w-4 text-right">{kl.count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Top Keywords */}
              <div className="rounded-xl border bg-card p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm">Top Keyword Patterns</h3>
                  <span className="text-xs text-muted-foreground">{result.patterns.topKeywords.length} found</span>
                </div>
                {result.patterns.topKeywords.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {result.patterns.topKeywords.slice(0, 20).map(kw => (
                      <span key={kw} className="px-2.5 py-1 bg-primary/10 text-primary rounded-lg text-xs font-mono font-semibold border border-primary/20">{kw}</span>
                    ))}
                  </div>
                ) : <p className="text-xs text-muted-foreground">Not enough data</p>}
              </div>

              {/* Stats */}
              <div className="rounded-xl border bg-card p-5 space-y-3">
                <h3 className="font-semibold text-sm">Portfolio Intelligence</h3>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "Total Analysed", val: result.patterns.totalAnalyzed },
                    { label: "High-Value", val: result.patterns.highValueCount },
                    { label: "Avg Score", val: `${Math.round(result.patterns.avgScore)}/100` },
                    { label: "Avg Age", val: `${result.patterns.avgDomainAge?.toFixed(1) ?? "—"}y` },
                  ].map(s => (
                    <div key={s.label} className="bg-muted/30 rounded-xl p-3 text-center">
                      <div className="text-xl font-bold">{s.val}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Tab: Actions */}
          {activeTab === "actions" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="rounded-xl border bg-card p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🎯</span>
                  <div>
                    <h3 className="font-semibold">Hunt These Domains</h3>
                    <p className="text-xs text-muted-foreground">Send {result.domains.length} competitor domains straight to the Hunt pipeline for full SEO scoring.</p>
                  </div>
                </div>
                <div className="bg-muted/30 rounded-lg p-3 text-xs font-mono text-muted-foreground max-h-32 overflow-y-auto">
                  {result.domains.slice(0, 10).map(d => <div key={d.domain}>{d.domain}</div>)}
                  {result.domains.length > 10 && <div className="text-primary">+{result.domains.length - 10} more…</div>}
                </div>
                <button onClick={huntNow} disabled={result.domains.length === 0} className="w-full h-10 rounded-lg bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 disabled:opacity-50">🎯 Hunt All Domains Now</button>
              </div>

              <div className="rounded-xl border bg-card p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">📥</span>
                  <div>
                    <h3 className="font-semibold">Import as Niche</h3>
                    <p className="text-xs text-muted-foreground">Create a new niche from {result.patterns.topKeywords.length} discovered keyword patterns so future scans target similar domains.</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {result.patterns.topKeywords.slice(0, 8).map(kw => (
                    <span key={kw} className="px-2 py-0.5 bg-primary/10 text-primary rounded text-[10px] font-mono">{kw}</span>
                  ))}
                </div>
                <button onClick={importNiche} disabled={importing || imported || result.patterns.topKeywords.length === 0} className="w-full h-10 rounded-lg border-2 border-primary text-primary font-bold text-sm hover:bg-primary/10 disabled:opacity-50">
                  {imported ? "✅ Niche Imported Successfully!" : importing ? "Importing…" : "📥 Import as New Niche"}
                </button>
                {imported && <p className="text-xs text-green-400 text-center">Check <a href="/settings/niches" className="underline font-semibold">/settings/niches</a> to see your new niche.</p>}
              </div>
            </div>
          )}
        </>
      )}

      {/* Empty State */}
      {!loading && !result && !error && (
        <div className="rounded-xl border border-dashed bg-card/50 p-16 text-center">
          <div className="text-5xl mb-4">🕵️</div>
          <h2 className="text-lg font-semibold mb-2">Enter a competitor to start spying</h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">We'll map their full domain portfolio, score every domain through our pipeline, and extract keyword + TLD patterns you can replicate.</p>
          <div className="flex flex-wrap justify-center gap-2">
            {PRESETS.map(p => (
              <button key={p.val} onClick={() => analyze(p.val)} className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-muted/50 hover:border-primary/50 transition-colors font-medium">
                🌐 {p.val}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
