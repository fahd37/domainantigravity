"use client";
import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ScatterChart, Scatter, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ZAxis } from "recharts";

interface Niche {
  id: string; slug: string; displayName: string;
  avgCompetitionScore: number; avgDomainAge: number; avgDR: number;
  topResultsHaveExpired: boolean; totalKeywords: number; avgMonthlySearches: number;
  topKeywordVolume: number; topKeyword: string; avgCPC: number;
  affiliateAvailable: boolean; avgCommission: number; estimatedRPM: number;
  monthlyRevenuePerSite: number; parasiteSuccessRate: number; avgTimeToRank: number;
  expiredDomainsAvailable: number; indexationRate: number; competitorCount: number;
  difficulty: string; opportunity: string; topKeywords: KW[]; affiliatePrograms: AP[];
  lastAnalyzed: string; dataSource: string; opportunityScore: number;
}
interface KW { keyword: string; volume: number; cpc: number; difficulty: number; }
interface AP { name: string; commission: string; cookie: string; network: string; }

const DIFF_COLOR: Record<string, string> = { "EASY": "bg-green-500/20 text-green-400 border-green-500/30", "MEDIUM": "bg-yellow-500/20 text-yellow-400 border-yellow-500/30", "HARD": "bg-orange-500/20 text-orange-400 border-orange-500/30", "VERY HARD": "bg-red-500/20 text-red-400 border-red-500/30" };
const OPP_COLOR: Record<string, string> = { "HOT": "bg-orange-500/20 text-orange-400 border-orange-500/30", "GOOD": "bg-blue-500/20 text-blue-400 border-blue-500/30", "MODERATE": "bg-gray-500/20 text-gray-400 border-gray-500/30", "SATURATED": "bg-red-500/20 text-red-400 border-red-500/30" };
const SCATTER_COLOR: Record<string, string> = { "HOT": "#f97316", "GOOD": "#3b82f6", "MODERATE": "#6b7280", "SATURATED": "#ef4444" };
const OPTIMAL_THRESHOLD: Record<string, number> = { "EASY": 55, "MEDIUM": 60, "HARD": 65, "VERY HARD": 70 };
const TREND = ["↑ TRENDING UP","→ STABLE","↑ TRENDING UP","→ STABLE","🔥 SEASONAL PEAK","↓ COOLING DOWN","→ STABLE","🔥 SEASONAL PEAK","→ STABLE","↓ COOLING DOWN"];

function Badge({ label, colorClass }: { label: string; colorClass: string }) {
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${colorClass}`}>{label}</span>;
}
function Bar({ value, color = "bg-primary" }: { value: number; color?: string }) {
  return <div className="flex items-center gap-2"><div className="h-1.5 w-24 rounded-full bg-muted overflow-hidden"><div className={`h-full ${color} rounded-full`} style={{ width: `${Math.min(100, value)}%` }} /></div><span className="text-xs">{value}%</span></div>;
}

export default function NicheIntelligencePage() {
  const router = useRouter();
  const [niches, setNiches] = useState<Niche[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<keyof Niche>("opportunityScore");
  const [sortDir, setSortDir] = useState<"asc"|"desc">("desc");
  const [selectedNiche, setSelectedNiche] = useState<Niche|null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [domsPerDay, setDomsPerDay] = useState(5);
  const [threshold, setThreshold] = useState(65);
  const [convRate, setConvRate] = useState(3);

  useEffect(() => {
    fetch("/api/niche-intelligence").then(r => r.json()).then(j => { if (j.niches) setNiches(j.niches); }).finally(() => setLoading(false));
  }, []);

  const sorted = useMemo(() => {
    return [...niches].sort((a, b) => {
      const av = a[sortBy] as number, bv = b[sortBy] as number;
      return sortDir === "desc" ? bv - av : av - bv;
    });
  }, [niches, sortBy, sortDir]);

  function toggleSort(col: keyof Niche) {
    if (sortBy === col) setSortDir(d => d === "desc" ? "asc" : "desc");
    else { setSortBy(col); setSortDir("desc"); }
  }

  const best = niches[0], highRPM = [...niches].sort((a,b)=>b.estimatedRPM-a.estimatedRPM)[0];
  const easiest = [...niches].sort((a,b)=>a.avgTimeToRank-b.avgTimeToRank)[0];
  const mostDoms = [...niches].sort((a,b)=>b.expiredDomainsAvailable-a.expiredDomainsAvailable)[0];

  const calcDomMonth = domsPerDay * 30;
  const successR = selectedNiche ? selectedNiche.parasiteSuccessRate / 100 : 0.6;
  const ranked = Math.round(calcDomMonth * successR);
  const traffic = ranked * 850;
  const revenueMin = Math.round(traffic * 0.012);
  const revenueMax = Math.round(traffic * 0.028);
  const breakEven = revenueMin > 0 ? Math.round((10 * calcDomMonth) / (revenueMin / 30)) : 0;
  const roi6m = revenueMin > 0 ? Math.round(((revenueMin * 6 - 10 * calcDomMonth) / (10 * calcDomMonth)) * 100) : 0;

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">🧠 Niche Intelligence</h1>
        <p className="text-muted-foreground mt-1">Data-driven niche analysis for parasite SEO. Research-backed metrics on competition, revenue, and success rates.</p>
      </div>

      {/* Section 1 — Summary Cards */}
      {!loading && niches.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Best Niche Right Now", value: best?.displayName, sub: `${best?.parasiteSuccessRate}% success rate`, icon: "🔥", color: "text-orange-400" },
            { label: "Highest RPM", value: highRPM?.displayName, sub: `$${highRPM?.estimatedRPM} RPM`, icon: "💰", color: "text-green-400" },
            { label: "Easiest to Rank", value: easiest?.displayName, sub: `${easiest?.avgTimeToRank} days avg`, icon: "⚡", color: "text-yellow-400" },
            { label: "Most Domains Available", value: mostDoms?.displayName, sub: `${mostDoms?.expiredDomainsAvailable.toLocaleString()} expired`, icon: "🌐", color: "text-blue-400" },
          ].map(c => (
            <div key={c.label} className="rounded-xl border bg-card p-5">
              <div className="text-2xl mb-2">{c.icon}</div>
              <div className="text-xs text-muted-foreground mb-1">{c.label}</div>
              <div className={`text-lg font-bold ${c.color}`}>{c.value}</div>
              <div className="text-xs text-muted-foreground">{c.sub}</div>
            </div>
          ))}
        </div>
      )}

      {/* Section 2 — Comparison Table */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="font-semibold text-lg">Niche Comparison</h2>
          <span className="text-xs text-muted-foreground">Click column headers to sort · Click row to open detail</span>
        </div>
        {loading ? (
          <div className="p-12 text-center text-muted-foreground">Loading intelligence data...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  {[
                    ["displayName","Niche"],["difficulty","Difficulty"],["opportunity","Opportunity"],
                    ["parasiteSuccessRate","Success %"],["avgTimeToRank","Rank Time"],
                    ["expiredDomainsAvailable","Domains"],["indexationRate","Indexed %"],
                    ["estimatedRPM","RPM"],["monthlyRevenuePerSite","$/Month"],["avgCPC","CPC"],
                  ].map(([key, label]) => (
                    <th key={key} onClick={() => toggleSort(key as keyof Niche)} className="px-4 py-3 text-left font-medium text-muted-foreground cursor-pointer hover:text-foreground whitespace-nowrap select-none">
                      {label} {sortBy === key ? (sortDir === "desc" ? "↓" : "↑") : ""}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((n, i) => (
                  <tr key={n.slug} onClick={() => { setSelectedNiche(n); setDrawerOpen(true); }} className="border-b hover:bg-muted/20 cursor-pointer transition-colors">
                    <td className="px-4 py-3 font-medium whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="text-base">{TREND[i % TREND.length].split(" ")[0]}</span>
                        {n.displayName}
                      </div>
                    </td>
                    <td className="px-4 py-3"><Badge label={n.difficulty} colorClass={DIFF_COLOR[n.difficulty] || ""} /></td>
                    <td className="px-4 py-3"><Badge label={n.opportunity} colorClass={OPP_COLOR[n.opportunity] || ""} /></td>
                    <td className="px-4 py-3">
                      <Bar value={n.parasiteSuccessRate} color={n.parasiteSuccessRate >= 60 ? "bg-green-500" : n.parasiteSuccessRate >= 40 ? "bg-yellow-500" : "bg-red-500"} />
                    </td>
                    <td className="px-4 py-3">
                      <span className={`font-mono font-bold ${n.avgTimeToRank < 10 ? "text-green-400" : n.avgTimeToRank < 20 ? "text-yellow-400" : "text-red-400"}`}>{n.avgTimeToRank}d</span>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={e => { e.stopPropagation(); router.push(`/hunt?niche=${n.slug}&threshold=${OPTIMAL_THRESHOLD[n.difficulty]}&source=intelligence`); }} className="font-mono text-blue-400 hover:text-blue-300 hover:underline">
                        {n.expiredDomainsAvailable.toLocaleString()}
                      </button>
                    </td>
                    <td className="px-4 py-3"><Bar value={n.indexationRate} color="bg-primary" /></td>
                    <td className="px-4 py-3 font-mono">${n.estimatedRPM}</td>
                    <td className="px-4 py-3 font-mono text-green-400">${n.monthlyRevenuePerSite}</td>
                    <td className="px-4 py-3 font-mono">${n.avgCPC.toFixed(2)}</td>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <div className="flex gap-1">
                        <button onClick={() => { setSelectedNiche(n); setDrawerOpen(true); }} className="px-2 py-1 text-xs rounded bg-muted hover:bg-muted/80">Analyze</button>
                        <button onClick={() => router.push(`/hunt?niche=${n.slug}&threshold=${OPTIMAL_THRESHOLD[n.difficulty]}&source=intelligence`)} className="px-2 py-1 text-xs rounded bg-green-600/20 text-green-400 hover:bg-green-600/40">Hunt</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Section 4 — Opportunity Matrix */}
      <div className="rounded-xl border bg-card p-6">
        <h2 className="font-semibold text-lg mb-1">Opportunity Matrix</h2>
        <p className="text-xs text-muted-foreground mb-4">X = Competition (lower = easier) · Y = Monthly Revenue/Site · Size = Available Domains</p>
        <ResponsiveContainer width="100%" height={340}>
          <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
            <XAxis dataKey="avgCompetitionScore" name="Competition" type="number" domain={[0,100]} label={{ value: "Competition Score", position: "insideBottom", offset: -10, fontSize: 11 }} tick={{ fontSize: 11 }} />
            <YAxis dataKey="monthlyRevenuePerSite" name="Revenue" type="number" label={{ value: "$/Month", angle: -90, position: "insideLeft", fontSize: 11 }} tick={{ fontSize: 11 }} />
            <ZAxis dataKey="expiredDomainsAvailable" range={[40, 400]} />
            <Tooltip cursor={{ strokeDasharray: "3 3" }} content={({ payload }) => {
              if (!payload?.length) return null;
              const d = payload[0].payload as Niche;
              return (
                <div className="bg-card border rounded-lg p-3 text-xs shadow-xl">
                  <div className="font-bold mb-1">{d.displayName}</div>
                  <div>Success: {d.parasiteSuccessRate}%</div>
                  <div>Revenue: ${d.monthlyRevenuePerSite}/mo</div>
                  <div>Domains: {d.expiredDomainsAvailable}</div>
                </div>
              );
            }} />
            <Scatter data={niches} isAnimationActive={false}>
              {niches.map((n) => (
                <Cell key={n.slug} fill={SCATTER_COLOR[n.opportunity] || "#6b7280"} fillOpacity={0.8} />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
        <div className="flex gap-4 mt-2 justify-center text-xs text-muted-foreground">
          {Object.entries(SCATTER_COLOR).map(([k, v]) => (
            <span key={k} className="flex items-center gap-1"><span className="h-2 w-2 rounded-full inline-block" style={{ backgroundColor: v }} />{k}</span>
          ))}
        </div>
      </div>

      {/* Section 5 — Revenue Calculator */}
      <div className="rounded-xl border bg-card p-6">
        <h2 className="font-semibold text-lg mb-4">💰 Revenue Calculator</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-5">
            {[
              { label: `Domains per day: ${domsPerDay}`, min: 1, max: 20, val: domsPerDay, set: setDomsPerDay },
              { label: `Score threshold: ${threshold}`, min: 50, max: 80, val: threshold, set: setThreshold },
              { label: `Conversion rate: ${convRate}%`, min: 1, max: 10, val: convRate, set: setConvRate },
            ].map(s => (
              <div key={s.label}>
                <label className="text-sm font-medium mb-2 block">{s.label}</label>
                <input type="range" min={s.min} max={s.max} value={s.val} onChange={e => s.set(Number(e.target.value))} className="w-full accent-primary" />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Domains/Month", value: calcDomMonth.toLocaleString() },
              { label: "Expected Ranked", value: ranked.toLocaleString() },
              { label: "Monthly Traffic", value: `${traffic.toLocaleString()} visits` },
              { label: "Revenue Range", value: `$${revenueMin.toLocaleString()} – $${revenueMax.toLocaleString()}` },
              { label: "Break-even", value: `${breakEven} days` },
              { label: "6-Month ROI", value: `${roi6m}%`, color: roi6m > 0 ? "text-green-400" : "text-red-400" },
            ].map(m => (
              <div key={m.label} className="rounded-lg bg-muted/40 p-3">
                <div className="text-xs text-muted-foreground">{m.label}</div>
                <div className={`text-base font-bold mt-0.5 ${m.color || ""}`}>{m.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Section 6 — Trend Indicator */}
      <div className="rounded-xl border bg-card p-6">
        <h2 className="font-semibold text-lg mb-4">📈 Niche Trend Signals</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {niches.map((n, i) => (
            <div key={n.slug} className="rounded-lg bg-muted/20 p-3 border border-border/50">
              <div className="text-xs font-medium mb-1">{n.displayName}</div>
              <div className={`text-sm font-bold ${TREND[i % TREND.length].startsWith("↑") ? "text-green-400" : TREND[i % TREND.length].startsWith("↓") ? "text-red-400" : TREND[i % TREND.length].startsWith("🔥") ? "text-orange-400" : "text-muted-foreground"}`}>
                {TREND[i % TREND.length]}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Drawer */}
      {drawerOpen && selectedNiche && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/60" onClick={() => setDrawerOpen(false)} />
          <div className="w-full max-w-2xl bg-card border-l overflow-y-auto p-6 space-y-6 animate-in slide-in-from-right duration-300">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-2xl font-bold">{selectedNiche.displayName}</h2>
                <div className="flex gap-2 mt-2">
                  <Badge label={selectedNiche.difficulty} colorClass={DIFF_COLOR[selectedNiche.difficulty] || ""} />
                  <Badge label={selectedNiche.opportunity} colorClass={OPP_COLOR[selectedNiche.opportunity] || ""} />
                </div>
              </div>
              <button onClick={() => setDrawerOpen(false)} className="text-muted-foreground hover:text-foreground text-xl">✕</button>
            </div>

            {/* Panel A — Overview stats */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Parasite Success", value: `${selectedNiche.parasiteSuccessRate}%`, color: selectedNiche.parasiteSuccessRate >= 60 ? "text-green-400" : "text-yellow-400" },
                { label: "Avg Time to Rank", value: `${selectedNiche.avgTimeToRank} days` },
                { label: "Expired Domains", value: selectedNiche.expiredDomainsAvailable.toLocaleString(), color: "text-blue-400" },
                { label: "Indexation Rate", value: `${selectedNiche.indexationRate}%` },
                { label: "Est. RPM", value: `$${selectedNiche.estimatedRPM}`, color: "text-green-400" },
                { label: "Revenue/Site/Mo", value: `$${selectedNiche.monthlyRevenuePerSite}`, color: "text-green-400" },
              ].map(m => (
                <div key={m.label} className="rounded-lg bg-muted/40 p-3">
                  <div className="text-xs text-muted-foreground">{m.label}</div>
                  <div className={`text-lg font-bold mt-0.5 ${m.color || ""}`}>{m.value}</div>
                </div>
              ))}
            </div>

            {/* Panel B — Top Keywords */}
            <div>
              <h3 className="font-semibold mb-3">🔑 Top Keywords</h3>
              <div className="space-y-2">
                {(selectedNiche.topKeywords as KW[]).map(kw => (
                  <div key={kw.keyword} className="flex items-center justify-between rounded-lg bg-muted/20 px-3 py-2 text-sm">
                    <span className="font-medium">{kw.keyword}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground">{(kw.volume/1000).toFixed(0)}k/mo</span>
                      <span className="text-xs text-green-400">${kw.cpc.toFixed(2)} CPC</span>
                      <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full bg-orange-500 rounded-full" style={{ width: `${kw.difficulty}%` }} />
                      </div>
                      <span className="text-xs">{kw.difficulty}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Panel C — Affiliate Programs */}
            <div>
              <h3 className="font-semibold mb-3">💸 Affiliate Programs</h3>
              <div className="space-y-2">
                {(selectedNiche.affiliatePrograms as AP[]).map(ap => (
                  <div key={ap.name} className="flex items-center justify-between rounded-lg bg-muted/20 px-3 py-2 text-sm">
                    <div>
                      <div className="font-medium">{ap.name}</div>
                      <div className="text-xs text-muted-foreground">{ap.network} · {ap.cookie}</div>
                    </div>
                    <span className="text-green-400 font-semibold text-xs">{ap.commission}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Panel D — Strategy */}
            <div className="rounded-lg bg-primary/5 border border-primary/20 p-4">
              <h3 className="font-semibold mb-2">🎯 Parasite SEO Strategy</h3>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>For <strong className="text-foreground">{selectedNiche.displayName}</strong>, target expired domains with age &gt; {selectedNiche.avgDomainAge.toFixed(1)} years and DR &gt; {Math.round(selectedNiche.avgDR * 0.7)}.</p>
                <p>Best TLDs: .com, .net, .io — look for domains with existing backlinks in this niche.</p>
                <p>Avg time to first ranking: <strong className="text-foreground">{selectedNiche.avgTimeToRank} days</strong>. Publish content targeting &quot;{selectedNiche.topKeyword}&quot; first.</p>
                <p>Expected earnings: <strong className="text-green-400">${Math.round(selectedNiche.monthlyRevenuePerSite * 0.7)}–${selectedNiche.monthlyRevenuePerSite}/month</strong> per ranked site.</p>
                <p>Avoid domains previously used for spam, gambling, or adult content. Check Majestic Trust Flow &gt; 15.</p>
              </div>
            </div>

            {/* Panel E — Hunt Button */}
            <button
              onClick={() => { setDrawerOpen(false); router.push(`/hunt?niche=${selectedNiche.slug}&threshold=${OPTIMAL_THRESHOLD[selectedNiche.difficulty]}&source=intelligence`); }}
              className="w-full py-4 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold text-lg transition-colors flex items-center justify-center gap-2"
            >
              🎯 Start Hunting {selectedNiche.displayName} Domains
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
