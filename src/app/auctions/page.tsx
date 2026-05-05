"use client";
import { useEffect, useState, useCallback } from "react";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";

interface Auction {
  domain: string; currentBid: number; bidCount: number; hoursRemaining: number;
  listingId: string; domainScore: number; opportunityScore: number;
  maxBid: number; reason: string; source: string; niche?: string | null; nicheMatch?: boolean;
}
interface Watched { id: string; domain: string; listingId: string; currentBid: number; maxBid: number; bidCount: number; hoursRemaining: number; opportunityScore: number; status: string; }

const ICONS: Record<string, string> = { iptv:"📺",artificial_intelligence:"🤖",digital_marketing:"📈",finance:"💰",health_wellness:"🏥",saas_software:"⚙️",ecommerce:"🛒",crypto:"₿",cybersecurity:"🔐",education:"🎓",travel:"✈️",real_estate:"🏠",fitness_gyms:"💪",developer_tools:"👨‍💻",gambling_casinos:"🎰",mental_health:"🧠",music_instruments:"🎸" };

function Pill({ score }: { score: number }) {
  const [cls, txt] = score >= 75 ? ["bg-orange-500/20 text-orange-400 border-orange-500/30", "🔥 HOT"] : score >= 55 ? ["bg-green-500/20 text-green-400 border-green-500/30", "✅ GOOD"] : score >= 35 ? ["bg-blue-500/20 text-blue-400 border-blue-500/30", "👀 WATCH"] : ["bg-muted text-muted-foreground border-border", "SKIP"];
  return <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${cls}`}>{txt}</span>;
}

function Timer({ h }: { h: number }) {
  const hrs = Math.floor(h), min = Math.floor((h - hrs) * 60);
  return <span className={`font-mono font-bold text-sm ${h < 2 ? "text-red-400 animate-pulse" : h < 6 ? "text-yellow-400" : "text-green-400"}`}>{hrs}h {min}m</span>;
}

function Ring({ score, size = 44 }: { score: number; size?: number }) {
  const c = score >= 60 ? "#22c55e" : score >= 40 ? "#eab308" : "#ef4444";
  const r = 18, circ = 2 * Math.PI * r, dash = (score / 100) * circ;
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" className="flex-shrink-0">
      <circle cx="22" cy="22" r={r} fill="none" stroke="currentColor" strokeWidth="3" className="text-muted/40" />
      <circle cx="22" cy="22" r={r} fill="none" stroke={c} strokeWidth="3" strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" transform="rotate(-90 22 22)" />
      <text x="22" y="22" textAnchor="middle" dominantBaseline="central" fill={c} fontSize="10" fontWeight="bold">{score}</text>
    </svg>
  );
}

const SORT_OPTIONS = [
  { val: "opportunity", label: "🎯 Opportunity" },
  { val: "score", label: "📊 Domain Score" },
  { val: "price", label: "💰 Lowest Price" },
  { val: "ending", label: "⏱ Ending Soon" },
];
const HOURS = [{ label: "All", v: 999 }, { label: "48h", v: 48 }, { label: "24h", v: 24 }, { label: "6h", v: 6 }, { label: "⚡", v: 2 }];

export default function AuctionsPage() {
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [watched, setWatched] = useState<Watched[]>([]);
  const [niches, setNiches] = useState<{ slug: string; displayName: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState<{ godaddyCount: number; dbCount: number; total: number } | null>(null);
  const [keyword, setKeyword] = useState("");
  const [niche, setNiche] = useState("");
  const [maxBid, setMaxBid] = useState([1000]);
  const [minOpp, setMinOpp] = useState([0]);
  const [hours, setHours] = useState(999);
  const [sort, setSort] = useState("opportunity");
  const [autoWatch, setAutoWatch] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [placing, setPlacing] = useState<Record<string, boolean>>({});
  const [watching, setWatching] = useState<Record<string, boolean>>({});
  const [customBids, setCustomBids] = useState<Record<string, number>>({});
  const [tab, setTab] = useState<"live" | "watched">("live");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const j = await fetch("/api/auctions").then(r => r.json());
      if (j.auctions) setAuctions(j.auctions);
      if (j.watched) setWatched(j.watched);
      if (j.meta) setMeta(j.meta);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    load();
    fetch("/api/niches").then(r => r.json()).then(j => { if (j.data) setNiches(j.data.filter((n: { active: boolean }) => n.active)); }).catch(() => {});
    const id = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    if (!autoWatch) return;
    auctions.filter(a => a.opportunityScore >= 70 && !watched.some(w => w.listingId === a.listingId)).forEach(doWatch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoWatch, auctions]);

  async function doWatch(a: Auction) {
    setWatching(p => ({ ...p, [a.listingId]: true }));
    await fetch("/api/auctions/watch", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ domain: a.domain, listingId: a.listingId, currentBid: a.currentBid, maxBid: customBids[a.listingId] ?? a.maxBid, bidCount: a.bidCount, hoursRemaining: a.hoursRemaining, opportunityScore: a.opportunityScore }) }).catch(() => {});
    setWatching(p => ({ ...p, [a.listingId]: false }));
    load();
  }

  async function doBid(a: Auction) {
    setPlacing(p => ({ ...p, [a.listingId]: true }));
    const r = await fetch("/api/auctions/bid", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ listingId: a.listingId, bidAmount: customBids[a.listingId] ?? a.currentBid + 1 }) }).then(r => r.json()).catch(() => ({ error: "Network error" }));
    setPlacing(p => ({ ...p, [a.listingId]: false }));
    if (r.error) alert(`Bid failed: ${r.error}`); else { alert(`✅ Bid placed: $${r.newBid}`); load(); }
  }

  const filtered = auctions.filter(a => {
    if (keyword && !a.domain.toLowerCase().includes(keyword.toLowerCase())) return false;
    if (niche && a.niche !== niche) return false;
    if (a.currentBid > maxBid[0]) return false;
    if (a.hoursRemaining > hours) return false;
    if (a.opportunityScore < minOpp[0]) return false;
    return true;
  }).sort((a, b) => sort === "score" ? b.domainScore - a.domainScore : sort === "price" ? a.currentBid - b.currentBid : sort === "ending" ? a.hoursRemaining - b.hoursRemaining : b.opportunityScore - a.opportunityScore);

  const hot = filtered.filter(a => a.opportunityScore >= 75).length;
  const good = filtered.filter(a => a.opportunityScore >= 55 && a.opportunityScore < 75).length;
  const noComp = filtered.filter(a => a.bidCount === 0).length;
  const avgScore = filtered.length ? Math.round(filtered.reduce((s, a) => s + a.opportunityScore, 0) / filtered.length) : 0;

  return (
    <div className="flex flex-col gap-5 pb-10">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Domain Hunter</h1>
          <p className="text-muted-foreground mt-1.5 text-sm">
            Live dropped domains + GoDaddy auctions scored against your niche keywords.
            {meta && <span className="ml-2 text-xs text-muted-foreground/60">GoDaddy: {meta.godaddyCount} · WhoisFreaks DB: {meta.dbCount}</span>}
          </p>
        </div>
        <button onClick={load} disabled={loading} className="h-9 px-4 rounded-lg border border-border text-sm font-medium hover:bg-muted/50 disabled:opacity-50 flex items-center gap-2 flex-shrink-0">
          {loading ? <><span className="h-3.5 w-3.5 border-2 border-muted-foreground/30 border-t-foreground rounded-full animate-spin" />Scanning…</> : "🔄 Refresh"}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Domains", val: filtered.length, sub: "matching filters", icon: "🏷️", c: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
          { label: "🔥 Hot Picks", val: hot, sub: "score ≥ 75", icon: "🔥", c: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/20" },
          { label: "⚡ No Competition", val: noComp, sub: "0 bids — easy wins", icon: "⚡", c: "text-green-400", bg: "bg-green-500/10 border-green-500/20" },
          { label: "Avg Opportunity", val: `${avgScore}/100`, sub: `${good} good deals`, icon: "📊", c: "text-purple-400", bg: "bg-purple-500/10 border-purple-500/20" },
        ].map(s => (
          <div key={s.label} className={`rounded-xl border p-4 ${s.bg}`}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">{s.label}</span>
              <span>{s.icon}</span>
            </div>
            <div className={`text-2xl font-bold ${s.c}`}>{s.val}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {[{ k: "live", label: `🏷 Live Opportunities (${filtered.length})` }, { k: "watched", label: `👁 Watchlist (${watched.length})` }].map(t => (
          <button key={t.k} onClick={() => setTab(t.k as "live" | "watched")} className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === t.k ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "watched" ? (
        <div className="rounded-xl border bg-card overflow-hidden">
          {watched.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground text-sm">No domains on watchlist yet. Click Watch on any opportunity.</div>
          ) : (
            <div className="divide-y">
              {watched.map(w => (
                <div key={w.id} className="px-5 py-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className={`h-2.5 w-2.5 rounded-full ${w.status === "WATCHING" ? "bg-blue-500 animate-pulse" : w.status === "WON" ? "bg-green-500" : "bg-red-500"}`} />
                    <div>
                      <div className="font-mono font-semibold text-sm">{w.domain}</div>
                      <div className="text-xs text-muted-foreground">Opp score: {w.opportunityScore}</div>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${w.status === "WATCHING" ? "bg-blue-500/20 text-blue-400" : w.status === "WON" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>{w.status}</span>
                  </div>
                  <div className="flex items-center gap-6 text-xs text-muted-foreground">
                    <span>Bid: <strong className="text-green-400">${w.currentBid}</strong></span>
                    <span>Max: <strong className="text-primary">${w.maxBid}</strong></span>
                    <span>Bids: {w.bidCount}</span>
                    <Timer h={w.hoursRemaining} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Filters */}
          <div className="rounded-xl border bg-card p-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Search Domain</label>
                <input className="w-full h-9 rounded-lg border border-input bg-transparent px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" placeholder="iptv, health, ai…" value={keyword} onChange={e => setKeyword(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Niche</label>
                <select className="w-full h-9 rounded-lg border border-input bg-transparent px-3 text-sm focus-visible:outline-none" value={niche} onChange={e => setNiche(e.target.value)}>
                  <option value="">All Niches</option>
                  {niches.map(n => <option key={n.slug} value={n.slug}>{ICONS[n.slug] ?? "🏷"} {n.displayName}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Max Price</label>
                  <span className="text-[10px] font-bold text-primary">${maxBid[0]}</span>
                </div>
                <Slider min={5} max={1000} step={5} value={maxBid} onValueChange={v => setMaxBid(v as number[])} />
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Min Opportunity</label>
                  <span className="text-[10px] font-bold text-primary">{minOpp[0]}</span>
                </div>
                <Slider min={0} max={100} step={5} value={minOpp} onValueChange={v => setMinOpp(v as number[])} />
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Ending</span>
                {HOURS.map(f => (
                  <button key={f.v} onClick={() => setHours(f.v)} className={`px-2.5 py-1 text-xs rounded-lg border font-medium transition-colors ${hours === f.v ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}>{f.label}</button>
                ))}
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <select className="h-8 rounded-lg border border-input bg-transparent px-2 text-xs focus-visible:outline-none" value={sort} onChange={e => setSort(e.target.value)}>
                  {SORT_OPTIONS.map(o => <option key={o.val} value={o.val}>{o.label}</option>)}
                </select>
                <div className="flex items-center gap-2">
                  <Switch checked={autoWatch} onCheckedChange={setAutoWatch} id="aw" />
                  <label htmlFor="aw" className="text-xs cursor-pointer font-medium">Auto-Watch ≥70</label>
                </div>
              </div>
            </div>
          </div>

          {/* Domains List */}
          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="px-5 py-3.5 border-b flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h2 className="font-semibold text-sm">Domain Opportunities</h2>
                <span className="text-xs text-muted-foreground">{filtered.length} found</span>
                {hot > 0 && <span className="text-[10px] font-bold text-orange-400 bg-orange-500/10 border border-orange-500/30 px-2 py-0.5 rounded-full">🔥 {hot} hot</span>}
              </div>
            </div>

            {loading && auctions.length === 0 && (
              <div className="flex flex-col items-center justify-center p-16 gap-4 text-muted-foreground">
                <div className="h-10 w-10 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                <div className="text-sm font-medium">Scanning dropped domains + GoDaddy auctions…</div>
                <div className="text-xs">Scoring against your {niches.length} active niches</div>
              </div>
            )}

            {!loading && filtered.length === 0 && (
              <div className="flex flex-col items-center justify-center p-16 gap-3 text-center">
                <div className="text-4xl">🔍</div>
                <div className="font-semibold">No domains match your filters</div>
                <p className="text-sm text-muted-foreground">Try relaxing price or opportunity filters, or run a scan first via Dashboard.</p>
              </div>
            )}

            <div className="divide-y divide-border">
              {filtered.map(a => {
                const isWatched = watched.some(w => w.listingId === a.listingId);
                const exp = expanded === a.listingId;
                const bid = customBids[a.listingId] ?? a.maxBid;
                const roi = a.domainScore > 0 && a.currentBid > 0 ? ((a.domainScore / a.currentBid) * 10).toFixed(1) : null;
                const sourceLabel = a.source === "godaddy-auction" ? "🔴 GoDaddy Live" : "🔵 WhoisFreaks Drop";

                return (
                  <div key={a.listingId} className={`transition-colors ${isWatched ? "bg-blue-500/5" : a.opportunityScore >= 75 ? "bg-orange-500/3 hover:bg-orange-500/5" : "hover:bg-muted/20"}`}>
                    <div className="px-5 py-4 flex items-center gap-4">
                      <Ring score={a.opportunityScore} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-bold text-sm">{a.domain}</span>
                          <Pill score={a.opportunityScore} />
                          {a.niche && <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-primary/10 text-primary">{ICONS[a.niche] ?? "🏷"} {a.niche.replace(/_/g, " ")}</span>}
                          {a.bidCount === 0 && <span className="text-[10px] font-bold text-green-400 bg-green-500/10 px-2 py-0.5 rounded border border-green-500/20">⚡ NO BIDS</span>}
                          <span className="text-[10px] text-muted-foreground">{sourceLabel}</span>
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-[11px] text-muted-foreground flex-wrap">
                          <span>Domain score: <strong className="text-foreground">{a.domainScore}</strong></span>
                          <span>Bids: <strong className="text-foreground">{a.bidCount}</strong></span>
                          {roi && <span>ROI: <strong className={parseFloat(roi) >= 5 ? "text-green-400" : "text-foreground"}>{roi}x</strong></span>}
                          {a.reason && <span className="italic truncate max-w-[280px]">{a.reason}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <div className="text-right">
                          <div className="text-lg font-bold text-green-400">${a.currentBid.toFixed(0)}</div>
                          <Timer h={a.hoursRemaining} />
                        </div>
                        <input type="number" value={bid} onChange={e => setCustomBids(p => ({ ...p, [a.listingId]: +e.target.value }))} className="h-8 w-20 rounded-lg border border-input bg-transparent px-2 text-sm font-mono text-center focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" title="Your max bid $" />
                        <button onClick={() => doWatch(a)} disabled={isWatched || watching[a.listingId]} className={`h-8 px-3 rounded-lg text-xs font-bold border transition-colors ${isWatched ? "bg-blue-500/15 text-blue-400 border-blue-500/30" : "border-border hover:bg-muted text-muted-foreground hover:text-foreground"}`}>
                          {watching[a.listingId] ? "…" : isWatched ? "👁 On" : "Watch"}
                        </button>
                        <button onClick={() => doBid(a)} disabled={placing[a.listingId]} className="h-8 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 disabled:opacity-50 transition-colors">
                          {placing[a.listingId] ? "…" : "🛒 Bid"}
                        </button>
                        <button onClick={() => setExpanded(exp ? null : a.listingId)} className="h-8 w-8 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:bg-muted/30 text-xs">{exp ? "▲" : "▼"}</button>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="px-5 pb-2">
                      <div className="h-1 bg-muted rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-700 ${a.opportunityScore >= 60 ? "bg-green-500" : a.opportunityScore >= 40 ? "bg-yellow-500" : "bg-red-500"}`} style={{ width: `${a.opportunityScore}%` }} />
                      </div>
                    </div>

                    {exp && (
                      <div className="px-5 pb-5 pt-3 border-t border-border bg-muted/10 space-y-3">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          {[
                            { label: "Current Bid", val: `$${a.currentBid}`, c: "text-green-400" },
                            { label: "Suggested Max", val: `$${a.maxBid.toFixed(0)}`, c: "text-primary" },
                            { label: "Domain Score", val: `${a.domainScore}/100`, c: "text-foreground" },
                            { label: "Opportunity", val: `${a.opportunityScore}/100`, c: a.opportunityScore >= 70 ? "text-orange-400" : "text-foreground" },
                          ].map(s => (
                            <div key={s.label} className="bg-card border rounded-xl p-3">
                              <div className="text-[10px] text-muted-foreground">{s.label}</div>
                              <div className={`text-base font-bold mt-0.5 ${s.c}`}>{s.val}</div>
                            </div>
                          ))}
                        </div>
                        {a.reason && (
                          <div className="text-xs bg-primary/5 border border-primary/20 rounded-lg px-4 py-2.5">
                            <span className="font-semibold">Factors: </span>
                            <span className="text-muted-foreground">{a.reason}</span>
                          </div>
                        )}
                        {a.source === "godaddy-auction" && (
                          <a href={`https://auctions.godaddy.com/trpItemListing.aspx?miid=${a.listingId}`} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline font-semibold">🔗 View on GoDaddy →</a>
                        )}
                        {a.source === "whoisfreaks-drop" && (
                          <a href={`https://www.namecheap.com/domains/registration/results/?domain=${a.domain}`} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline font-semibold">🔗 Register on Namecheap →</a>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
