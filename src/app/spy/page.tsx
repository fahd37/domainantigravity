"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

interface ScoredDomain {
  domain: string;
  score: number;
  recommendation: string;
  waybackPages: number;
  lastArchived: string | null;
  matchedNiche: string | null;
}

interface TopTLD { tld: string; count: number }
interface KeywordLength { length: number; label: string; count: number }

interface WinningPattern {
  topTLDs: TopTLD[];
  keywordLengths: KeywordLength[];
  topKeywords: string[];
  avgDomainAge: number;
  avgReferringDomains: number;
  avgScore: number;
  totalAnalyzed: number;
  highValueCount: number;
}

interface SpyResult {
  id?: string;
  competitorDomain: string;
  isTwitter: boolean;
  domains: ScoredDomain[];
  totalDiscovered: number;
  patterns: WinningPattern;
}

const PROGRESS_STEPS = [
  "Fetching portfolio...",
  "Analyzing patterns...",
  "Scoring domains...",
  "Extracting insights...",
];

function ScoreBar({ score }: { score: number }) {
  const color = score >= 55 ? "bg-green-500" : score >= 35 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 bg-muted rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs font-mono font-bold">{score}</span>
    </div>
  );
}

function PieChart({ data }: { data: TopTLD[] }) {
  const total = data.reduce((s, d) => s + d.count, 0) || 1;
  const colors = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];
  let cumAngle = 0;

  const slices = data.map((d, i) => {
    const pct = d.count / total;
    const startAngle = cumAngle;
    cumAngle += pct * 360;
    return { ...d, pct, startAngle, endAngle: cumAngle, color: colors[i % colors.length] };
  });

  function polarToCart(cx: number, cy: number, r: number, angleDeg: number) {
    const a = ((angleDeg - 90) * Math.PI) / 180;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  }

  return (
    <div className="flex items-center gap-4">
      <svg width="80" height="80" viewBox="0 0 80 80">
        {slices.map((s, i) => {
          const start = polarToCart(40, 40, 36, s.startAngle);
          const end = polarToCart(40, 40, 36, s.endAngle);
          const large = s.endAngle - s.startAngle > 180 ? 1 : 0;
          return (
            <path
              key={i}
              d={`M40,40 L${start.x},${start.y} A36,36,0,${large},1,${end.x},${end.y}Z`}
              fill={s.color}
            />
          );
        })}
      </svg>
      <div className="space-y-1">
        {slices.map((s, i) => (
          <div key={i} className="flex items-center gap-1.5 text-xs">
            <div className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: s.color }} />
            <span className="font-mono">{s.tld}</span>
            <span className="text-muted-foreground">({Math.round(s.pct * 100)}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SpyPage() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [progressStep, setProgressStep] = useState(0);
  const [result, setResult] = useState<SpyResult | null>(null);
  const [error, setError] = useState("");
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState(false);

  const handleAnalyze = async () => {
    if (!input.trim()) return;
    setLoading(true);
    setResult(null);
    setError("");
    setImported(false);
    setProgressStep(0);

    // Animate progress steps
    const stepInterval = setInterval(() => {
      setProgressStep(p => Math.min(p + 1, PROGRESS_STEPS.length - 1));
    }, 3000);

    try {
      const res = await fetch("/api/spy/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: input.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Analysis failed");
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      clearInterval(stepInterval);
      setLoading(false);
    }
  };

  const handleImportNiche = async () => {
    if (!result?.id) return;
    setImporting(true);
    try {
      const res = await fetch("/api/spy/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "import-niche", analysisId: result.id, competitorDomain: result.competitorDomain }),
      });
      const data = await res.json();
      if (data.success) setImported(true);
      else alert(data.error || "Import failed");
    } finally {
      setImporting(false);
    }
  };

  const handleHuntNow = () => {
    if (!result) return;
    const domains = result.domains.map(d => d.domain).join("\n");
    sessionStorage.setItem("spy_hunt_domains", domains);
    window.location.href = "/hunt";
  };

  return (
    <div className="flex flex-col gap-6 pb-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Competitor Spy</h1>
        <p className="text-muted-foreground mt-2">
          Analyze any competitor&apos;s domain portfolio and extract their winning patterns.
        </p>
      </div>

      {/* Input */}
      <div className="rounded-xl border bg-card shadow-sm p-6">
        <div className="flex gap-3">
          <input
            className="flex-1 h-11 rounded-md border border-input bg-transparent px-4 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            placeholder="moz.com, ahrefs.com, or @semrush (Twitter handle)"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleAnalyze()}
          />
          <Button className="h-11 px-6 font-semibold" onClick={handleAnalyze} disabled={loading || !input.trim()}>
            {loading ? "Analyzing..." : "🔍 Analyze"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Enter a competitor domain or @twitter handle. We&apos;ll map their full domain portfolio.
        </p>
      </div>

      {/* Loading Progress */}
      {loading && (
        <div className="rounded-xl border bg-card shadow-sm p-8">
          <div className="space-y-4">
            {PROGRESS_STEPS.map((step, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className={`h-5 w-5 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                  i < progressStep ? "bg-green-500" : i === progressStep ? "bg-primary animate-pulse" : "bg-muted"
                }`}>
                  {i < progressStep && <span className="text-white text-xs">✓</span>}
                </div>
                <span className={`text-sm ${i === progressStep ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                  {step}
                </span>
                {i === progressStep && (
                  <div className="flex gap-1">
                    {[0,1,2].map(dot => (
                      <div key={dot} className="h-1 w-1 rounded-full bg-primary animate-bounce" style={{ animationDelay: `${dot * 0.15}s` }} />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {result && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Panel 1 — Portfolio Map */}
          <div className="xl:col-span-2 rounded-xl border bg-card shadow-sm">
            <div className="p-4 border-b flex items-center justify-between">
              <div>
                <h2 className="font-semibold">Portfolio Map</h2>
                <p className="text-xs text-muted-foreground">{result.totalDiscovered} domains discovered · top 20 scored</p>
              </div>
              <span className={`text-xs px-2 py-1 rounded font-medium ${result.isTwitter ? "bg-blue-500/20 text-blue-500" : "bg-purple-500/20 text-purple-500"}`}>
                {result.isTwitter ? "Twitter" : "Domain Analysis"}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b">
                  <tr>
                    <th className="px-4 py-3 font-medium">Domain</th>
                    <th className="px-4 py-3 font-medium">Score</th>
                    <th className="px-4 py-3 font-medium">Wayback</th>
                    <th className="px-4 py-3 font-medium">Niche</th>
                    <th className="px-4 py-3 font-medium">Signal</th>
                  </tr>
                </thead>
                <tbody>
                  {result.domains.length === 0 && (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground text-sm">No domains found. Try a different competitor.</td></tr>
                  )}
                  {result.domains.map((d, i) => (
                    <tr key={i} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium">{d.domain}</td>
                      <td className="px-4 py-3"><ScoreBar score={d.score} /></td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{d.waybackPages} snaps</td>
                      <td className="px-4 py-3">
                        {d.matchedNiche
                          ? <span className="px-1.5 py-0.5 rounded text-xs bg-primary/20 text-primary">{d.matchedNiche}</span>
                          : <span className="text-muted-foreground text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                          d.recommendation === "buy" ? "bg-green-500/20 text-green-500" :
                          d.recommendation === "skip" ? "bg-yellow-500/20 text-yellow-500" :
                          "bg-muted text-muted-foreground"
                        }`}>{d.recommendation}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right column: Patterns + Action */}
          <div className="flex flex-col gap-4">
            {/* Panel 2 — Winning Patterns */}
            <div className="rounded-xl border bg-card shadow-sm p-5 space-y-5">
              <h2 className="font-semibold">Winning Patterns</h2>

              <div>
                <p className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wide">TLD Preference</p>
                {result.patterns.topTLDs.length > 0
                  ? <PieChart data={result.patterns.topTLDs} />
                  : <p className="text-xs text-muted-foreground">Not enough data</p>}
              </div>

              <div>
                <p className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wide">Keyword Length</p>
                <div className="space-y-2">
                  {result.patterns.keywordLengths.map(kl => {
                    const max = Math.max(...result.patterns.keywordLengths.map(k => k.count), 1);
                    return (
                      <div key={kl.length} className="flex items-center gap-2">
                        <span className="text-xs w-24 text-muted-foreground">{kl.label}</span>
                        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full" style={{ width: `${(kl.count / max) * 100}%` }} />
                        </div>
                        <span className="text-xs font-mono text-muted-foreground w-5">{kl.count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Top Keywords</p>
                <div className="flex flex-wrap gap-1">
                  {result.patterns.topKeywords.slice(0, 12).map(kw => (
                    <span key={kw} className="px-2 py-0.5 bg-muted rounded text-xs font-mono">{kw}</span>
                  ))}
                  {result.patterns.topKeywords.length === 0 && (
                    <span className="text-xs text-muted-foreground">Not enough data</span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="rounded-lg bg-muted/50 p-3 text-center">
                  <div className="text-lg font-bold">{result.patterns.highValueCount}</div>
                  <div className="text-xs text-muted-foreground">High-value domains</div>
                </div>
                <div className="rounded-lg bg-muted/50 p-3 text-center">
                  <div className="text-lg font-bold">{Math.round(result.patterns.avgScore)}</div>
                  <div className="text-xs text-muted-foreground">Avg score</div>
                </div>
              </div>
            </div>

            {/* Panel 3 — Your Action */}
            <div className="rounded-xl border bg-card shadow-sm p-5 space-y-3">
              <h2 className="font-semibold">Your Action</h2>
              <p className="text-xs text-muted-foreground">
                {result.patterns.topKeywords.length > 0
                  ? `Discovered ${result.patterns.topKeywords.length} keyword patterns and ${result.patterns.topTLDs.length} preferred TLDs.`
                  : "Patterns extracted. Import or hunt discovered domains."}
              </p>

              <Button
                className="w-full"
                onClick={handleImportNiche}
                disabled={importing || imported || result.patterns.topKeywords.length === 0}
              >
                {imported ? "✅ Niche Imported!" : importing ? "Importing..." : "📥 Import as Niche"}
              </Button>

              <Button
                variant="outline"
                className="w-full"
                onClick={handleHuntNow}
                disabled={result.domains.length === 0}
              >
                🎯 Hunt These Domains Now
              </Button>

              {imported && (
                <p className="text-xs text-green-500 text-center">
                  New niche added with {result.patterns.topKeywords.length} keywords. Check /settings/niches.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
