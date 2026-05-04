"use client";
import { useEffect, useState } from "react";

interface Data {
  summary: { totalScanned: number; avgScore: string; buyRate: string; totalSpent: number };
  velocity: { date: string; count: number }[];
  scoreDistribution: { range: string; count: number }[];
  nicheDistribution: { niche: string; count: number }[];
  rejectionReasons: { reason: string; count: number }[];
}

const NICHE_COLORS = ["#6366f1","#22c55e","#f59e0b","#ef4444","#8b5cf6","#06b6d4","#f43f5e","#84cc16","#ec4899","#14b8a6"];

function MiniBar({ data, color = "#6366f1" }: { data: { label: string; value: number }[]; color?: string }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div className="flex items-end gap-1 h-32">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <div className="w-full rounded-t-sm transition-all duration-500" style={{ height: `${(d.value / max) * 100}%`, minHeight: d.value > 0 ? "4px" : "1px", background: d.value > 0 ? color : "var(--muted)" }} />
          <span className="text-[8px] text-muted-foreground truncate w-full text-center">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

function SparkLine({ data, color = "#6366f1" }: { data: number[]; color?: string }) {
  if (data.length < 2) return null;
  const max = Math.max(...data, 1), min = Math.min(...data, 0);
  const h = 60, w = 200, range = max - min || 1;
  const points = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * (h - 4)}`).join(" ");
  const fillPoints = `0,${h} ${points} ${w},${h}`;
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <polygon points={fillPoints} fill={color} fillOpacity="0.15" />
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DonutChart({ data }: { data: { label: string; value: number; color: string }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const r = 40, circ = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="flex items-center gap-4">
      <svg width="100" height="100" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={r} fill="none" stroke="currentColor" strokeWidth="12" className="text-muted/20" />
        {data.map((d, i) => {
          const pct = d.value / total;
          const dash = pct * circ;
          const o = offset;
          offset += dash;
          return <circle key={i} cx="50" cy="50" r={r} fill="none" stroke={d.color} strokeWidth="12" strokeDasharray={`${dash} ${circ - dash}`} strokeDashoffset={-o} transform="rotate(-90 50 50)" />;
        })}
        <text x="50" y="50" textAnchor="middle" dominantBaseline="central" className="fill-foreground" fontSize="14" fontWeight="bold">{total}</text>
      </svg>
      <div className="space-y-1 flex-1 min-w-0">
        {data.slice(0, 6).map((d, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <div className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ background: d.color }} />
            <span className="truncate flex-1">{d.label}</span>
            <span className="font-mono text-muted-foreground">{d.value}</span>
            <span className="font-mono text-muted-foreground text-[10px]">{Math.round((d.value / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/analytics/stats").then(r => r.json()).then(j => { if (!j.error) setData(j); }).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex flex-col items-center gap-4 p-20 text-muted-foreground">
      <div className="h-10 w-10 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      <div className="text-sm">Loading analytics…</div>
    </div>
  );

  if (!data) return <div className="p-16 text-center text-muted-foreground">Failed to load analytics data.</div>;

  const totalScanned = data.summary.totalScanned;
  const avgScore = parseFloat(data.summary.avgScore);
  const buyRate = parseFloat(data.summary.buyRate);
  const totalSpent = data.summary.totalSpent;
  const bought = Math.round((buyRate / 100) * totalScanned);
  const highValue = data.scoreDistribution.filter(d => ["61-80", "81-100"].includes(d.range)).reduce((s, d) => s + d.count, 0);
  const velocityTotal = data.velocity.reduce((s, d) => s + d.count, 0);

  // Infer ROI
  const estValue = bought * 150; // conservative $150 avg value per domain
  const roi = totalSpent > 0 ? Math.round(((estValue - totalSpent) / totalSpent) * 100) : 0;

  return (
    <div className="flex flex-col gap-5 pb-10">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">📊 Analytics & ROI</h1>
        <p className="text-muted-foreground mt-1.5 text-sm">Track acquisition performance, scoring accuracy, and portfolio ROI in real-time.</p>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {[
          { label: "Total Scanned", val: totalScanned, icon: "🔍", c: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
          { label: "Avg Score", val: avgScore.toFixed(1), icon: "📊", c: "text-purple-400", bg: "bg-purple-500/10 border-purple-500/20" },
          { label: "High-Value", val: highValue, icon: "🔥", c: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/20" },
          { label: "Bought", val: bought, icon: "✅", c: "text-green-400", bg: "bg-green-500/10 border-green-500/20" },
          { label: "Total Spent", val: `$${totalSpent.toFixed(0)}`, icon: "💰", c: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/20" },
          { label: "Est. ROI", val: `${roi}%`, icon: roi >= 0 ? "📈" : "📉", c: roi >= 0 ? "text-green-400" : "text-red-400", bg: roi >= 0 ? "bg-green-500/10 border-green-500/20" : "bg-red-500/10 border-red-500/20" },
        ].map(s => (
          <div key={s.label} className={`rounded-xl border p-4 ${s.bg}`}>
            <div className="flex justify-between items-start mb-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{s.label}</span>
              <span>{s.icon}</span>
            </div>
            <div className={`text-2xl font-bold ${s.c}`}>{s.val}</div>
          </div>
        ))}
      </div>

      {/* Row 1: Velocity + Score Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Acquisition Velocity */}
        <div className="rounded-xl border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-sm">📈 Acquisition Velocity</h3>
              <p className="text-[10px] text-muted-foreground">Last 30 days · {velocityTotal} domains added</p>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold text-blue-400">{velocityTotal}</div>
              <div className="text-[10px] text-muted-foreground">this month</div>
            </div>
          </div>
          <SparkLine data={data.velocity.map(v => v.count)} color="#6366f1" />
          <div className="flex justify-between text-[9px] text-muted-foreground">
            <span>{data.velocity[0]?.date}</span>
            <span>{data.velocity[data.velocity.length - 1]?.date}</span>
          </div>
        </div>

        {/* Score Distribution */}
        <div className="rounded-xl border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-sm">📊 Score Distribution</h3>
              <p className="text-[10px] text-muted-foreground">{totalScanned} domains scored</p>
            </div>
          </div>
          <MiniBar
            data={data.scoreDistribution.map(d => ({ label: d.range, value: d.count }))}
            color="#22c55e"
          />
          <div className="grid grid-cols-5 gap-1 text-center">
            {data.scoreDistribution.map((d, i) => {
              const pct = totalScanned > 0 ? Math.round((d.count / totalScanned) * 100) : 0;
              const colors = ["text-red-400", "text-orange-400", "text-yellow-400", "text-green-400", "text-emerald-400"];
              return (
                <div key={d.range} className="text-xs">
                  <div className={`font-bold ${colors[i]}`}>{d.count}</div>
                  <div className="text-[9px] text-muted-foreground">{pct}%</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Row 2: Niche Distribution + Rejection Reasons */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Niche Distribution */}
        <div className="rounded-xl border bg-card p-5 space-y-4">
          <h3 className="font-semibold text-sm">🏷 Niche Distribution</h3>
          <DonutChart
            data={data.nicheDistribution
              .sort((a, b) => b.count - a.count)
              .slice(0, 8)
              .map((d, i) => ({ label: d.niche.replace(/_/g, " "), value: d.count, color: NICHE_COLORS[i % NICHE_COLORS.length] }))}
          />
        </div>

        {/* Rejection Analysis */}
        <div className="rounded-xl border bg-card p-5 space-y-4">
          <h3 className="font-semibold text-sm">❌ Top Rejection Reasons</h3>
          {data.rejectionReasons.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4">No rejections yet — all domains are passing filters.</p>
          ) : (
            <div className="space-y-3">
              {data.rejectionReasons.map((r, i) => {
                const max = data.rejectionReasons[0]?.count ?? 1;
                return (
                  <div key={i} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="truncate max-w-[200px]">{r.reason}</span>
                      <span className="font-mono font-bold text-red-400">{r.count}</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-red-500/60 rounded-full transition-all duration-700" style={{ width: `${(r.count / max) * 100}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Row 3: Performance Metrics */}
      <div className="rounded-xl border bg-card p-5 space-y-4">
        <h3 className="font-semibold text-sm">📈 Performance Metrics</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Buy Rate", val: `${buyRate.toFixed(1)}%`, desc: `${bought} of ${totalScanned} domains`, c: buyRate >= 5 ? "text-green-400" : "text-yellow-400" },
            { label: "Cost/Domain", val: bought > 0 ? `$${(totalSpent / bought).toFixed(2)}` : "—", desc: "avg acquisition cost", c: "text-foreground" },
            { label: "Est. Portfolio Value", val: `$${(bought * 150).toLocaleString()}`, desc: `${bought} domains × $150 avg`, c: "text-green-400" },
            { label: "Score Efficiency", val: avgScore >= 40 ? "Good" : avgScore >= 20 ? "Fair" : "Low", desc: `${avgScore.toFixed(1)} avg score`, c: avgScore >= 40 ? "text-green-400" : avgScore >= 20 ? "text-yellow-400" : "text-red-400" },
          ].map(m => (
            <div key={m.label} className="bg-muted/20 rounded-xl p-4">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{m.label}</div>
              <div className={`text-xl font-bold mt-1 ${m.c}`}>{m.val}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">{m.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Daily Activity Heatmap */}
      <div className="rounded-xl border bg-card p-5 space-y-3">
        <h3 className="font-semibold text-sm">📅 Daily Activity (Last 30 Days)</h3>
        <div className="flex gap-1 flex-wrap">
          {data.velocity.map((v, i) => {
            const intensity = v.count === 0 ? "bg-muted" : v.count <= 2 ? "bg-green-900" : v.count <= 5 ? "bg-green-700" : v.count <= 10 ? "bg-green-500" : "bg-green-400";
            return (
              <div key={i} className={`h-6 w-6 rounded-sm ${intensity} flex items-center justify-center`} title={`${v.date}: ${v.count} domains`}>
                {v.count > 0 && <span className="text-[7px] text-white font-bold">{v.count}</span>}
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <span>Less</span>
          <div className="h-3 w-3 rounded-sm bg-muted" />
          <div className="h-3 w-3 rounded-sm bg-green-900" />
          <div className="h-3 w-3 rounded-sm bg-green-700" />
          <div className="h-3 w-3 rounded-sm bg-green-500" />
          <div className="h-3 w-3 rounded-sm bg-green-400" />
          <span>More</span>
        </div>
      </div>
    </div>
  );
}
