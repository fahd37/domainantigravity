"use client";

import { useEffect, useState, useCallback } from "react";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";

interface AuctionResult {
  domain: string;
  currentBid: number;
  bidCount: number;
  hoursRemaining: number;
  listingId: string;
  domainScore: number;
  opportunityScore: number;
  maxBid: number;
  reason: string;
  source: string;
  niche?: string;
}

interface WatchedAuction {
  id: string;
  domain: string;
  listingId: string;
  currentBid: number;
  maxBid: number;
  bidCount: number;
  hoursRemaining: number;
  opportunityScore: number;
  status: string;
}

const HOURS_FILTERS = [
  { label: "All", value: 999 },
  { label: "24h", value: 24 },
  { label: "12h", value: 12 },
  { label: "6h", value: 6 },
  { label: "⚡ Ending", value: 2 },
];

function Countdown({ hours }: { hours: number }) {
  const h = Math.floor(hours);
  const m = Math.floor((hours - h) * 60);
  const cls = hours < 2 ? "text-red-400 animate-pulse" : hours < 6 ? "text-yellow-400" : "text-green-400";
  return <span className={`font-mono font-bold text-sm ${cls}`}>{h}h {m}m</span>;
}

function OpportunityBadge({ score }: { score: number }) {
  if (score >= 75) return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-500/20 text-green-400 border border-green-500/30">🔥 HOT</span>;
  if (score >= 55) return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">⭐ GOOD</span>;
  if (score >= 35) return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">👀 WATCH</span>;
  return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-muted text-muted-foreground border border-border">SKIP</span>;
}

function ScoreDial({ score }: { score: number }) {
  const color = score >= 60 ? "text-green-400 border-green-500/50" : score >= 40 ? "text-yellow-400 border-yellow-500/50" : "text-red-400 border-red-500/50";
  return (
    <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center font-bold text-xs ${color}`}>
      {score}
    </div>
  );
}

const NICHE_ICONS: Record<string, string> = {
  iptv: "📺", artificial_intelligence: "🤖", digital_marketing: "📈", finance: "💰",
  health_wellness: "🏥", saas_software: "⚙️", ecommerce: "🛒", crypto: "₿",
  cybersecurity: "🔐", education: "🎓", travel: "✈️", real_estate: "🏠",
};

export default function AuctionsPage() {
  const [auctions, setAuctions] = useState<AuctionResult[]>([]);
  const [watched, setWatched] = useState<WatchedAuction[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState("");
  const [maxBidFilter, setMaxBidFilter] = useState([500]);
  const [hoursFilter, setHoursFilter] = useState(999);
  const [minScore, setMinScore] = useState([0]);
  const [autoWatch, setAutoWatch] = useState(false);
  const [selectedNiche, setSelectedNiche] = useState("");
  const [sortBy, setSortBy] = useState<"opportunity" | "score" | "price" | "ending">("opportunity");
  const [customBids, setCustomBids] = useState<Record<string, number>>({});
  const [placing, setPlacing] = useState<Record<string, boolean>>({});
  const [watching, setWatching] = useState<Record<string, boolean>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [niches, setNiches] = useState<{slug: string; displayName: string}[]>([]);

  const fetchAuctions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/auctions");
      const json = await res.json();
      if (json.auctions) setAuctions(json.auctions);
      if (json.watched) setWatched(json.watched);
      setLastRefresh(new Date());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchAuctions();
    fetch("/api/niches").then(r => r.json()).then(j => { if (j.data) setNiches(j.data.filter((n: {active: boolean}) => n.active)); }).catch(() => {});
    const id = setInterval(fetchAuctions, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [fetchAuctions]);

  // Auto-watch high-score auctions
  useEffect(() => {
    if (!autoWatch || auctions.length === 0) return;
    auctions.filter(a => a.opportunityScore >= 70 && !watched.some(w => w.listingId === a.listingId))
      .forEach(a => handleWatch(a));
  }, [autoWatch, auctions]);

  const handleWatch = async (auction: AuctionResult) => {
    setWatching(p => ({ ...p, [auction.listingId]: true }));
    try {
      await fetch("/api/auctions/watch", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: auction.domain, listingId: auction.listingId, currentBid: auction.currentBid, maxBid: customBids[auction.listingId] ?? auction.maxBid, bidCount: auction.bidCount, hoursRemaining: auction.hoursRemaining, opportunityScore: auction.opportunityScore }),
      });
      await fetchAuctions();
    } finally { setWatching(p => ({ ...p, [auction.listingId]: false })); }
  };

  const handleBid = async (auction: AuctionResult) => {
    setPlacing(p => ({ ...p, [auction.listingId]: true }));
    try {
      const res = await fetch("/api/auctions/bid", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId: auction.listingId, bidAmount: customBids[auction.listingId] ?? auction.currentBid + 1 }),
      });
      const data = await res.json();
      if (!data.success) alert(`Bid failed: ${data.error}`);
      else { alert(`✅ Bid placed: $${data.newBid}`); fetchAuctions(); }
    } finally { setPlacing(p => ({ ...p, [auction.listingId]: false })); }
  };

  const allNiches = Array.from(new Set(auctions.map(a => a.niche).filter(Boolean)));

  const filtered = auctions.filter(a => {
    if (keyword && !a.domain.toLowerCase().includes(keyword.toLowerCase())) return false;
    if (a.currentBid > maxBidFilter[0]) return false;
    if (a.hoursRemaining > hoursFilter) return false;
    if (a.opportunityScore < minScore[0]) return false;
    if (selectedNiche && a.niche !== selectedNiche) return false;
    return true;
  }).sort((a, b) => {
    if (sortBy === "opportunity") return b.opportunityScore - a.opportunityScore;
    if (sortBy === "score") return b.domainScore - a.domainScore;
    if (sortBy === "price") return a.currentBid - b.currentBid;
    return a.hoursRemaining - b.hoursRemaining;
  });

  const hot = filtered.filter(a => a.opportunityScore >= 75).length;
  const good = filtered.filter(a => a.opportunityScore >= 55 && a.opportunityScore < 75).length;
  const totalValue = filtered.reduce((s, a) => s + a.currentBid, 0);
  const avgScore = filtered.length ? Math.round(filtered.reduce((s, a) => s + a.opportunityScore, 0) / filtered.length) : 0;

  return (
    <div className="flex flex-col gap-6 pb-10">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">GoDaddy Auctions</h1>
          <p className="text-muted-foreground mt-1.5">Live domain auctions scored against your niche keywords — with sniper auto-bidding.</p>
        </div>
        <div className="flex items-center gap-3">
          {lastRefresh && <span className="text-xs text-muted-foreground">Updated {lastRefresh.toLocaleTimeString()}</span>}
          <button onClick={fetchAuctions} disabled={loading} className="h-9 px-4 rounded-lg border border-border text-sm font-medium hover:bg-muted/50 disabled:opacity-50 flex items-center gap-2">
            {loading ? <><span className="h-3.5 w-3.5 border-2 border-muted-foreground/30 border-t-foreground rounded-full animate-spin"/>Loading…</> : "🔄 Refresh"}
          </button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Live Auctions", val: filtered.length, icon: "🏷️", color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
          { label: "🔥 Hot Picks", val: hot, icon: "🔥", color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/20" },
          { label: "⭐ Good Deals", val: good, icon: "⭐", color: "text-green-400", bg: "bg-green-500/10 border-green-500/20" },
          { label: "Avg Opportunity", val: `${avgScore}/100`, icon: "📊", color: "text-purple-400", bg: "bg-purple-500/10 border-purple-500/20" },
        ].map(s => (
          <div key={s.label} className={`rounded-xl border p-4 ${s.bg}`}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{s.label}</span>
              <span>{s.icon}</span>
            </div>
            <div className={`text-2xl font-bold ${s.color}`}>{s.val}</div>
          </div>
        ))}
      </div>

      {/* Watched Panel */}
      {watched.length > 0 && (
        <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b bg-blue-500/5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-blue-400 font-semibold text-sm">👁 Active Watchlist</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-400">{watched.length}</span>
            </div>
          </div>
          <div className="divide-y">
            {watched.map(w => (
              <div key={w.id} className="px-5 py-3 flex items-center justify-between gap-4 text-sm hover:bg-muted/20">
                <div className="flex items-center gap-3">
                  <span className={`h-2 w-2 rounded-full ${w.status === "WATCHING" ? "bg-blue-500 animate-pulse" : w.status === "WON" ? "bg-green-500" : "bg-red-500"}`} />
                  <span className="font-mono font-semibold">{w.domain}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${w.status === "WATCHING" ? "bg-blue-500/20 text-blue-400" : w.status === "WON" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>{w.status}</span>
                </div>
                <div className="flex items-center gap-6 text-xs text-muted-foreground">
                  <span>Current: <strong className="text-foreground">${w.currentBid}</strong></span>
                  <span>Max: <strong className="text-primary">${w.maxBid}</strong></span>
                  <span>Bids: <strong className="text-foreground">{w.bidCount}</strong></span>
                  <Countdown hours={w.hoursRemaining} />
                  <OpportunityBadge score={w.opportunityScore} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div className="rounded-xl border bg-card shadow-sm p-5">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Keyword Filter</label>
            <input className="w-full h-9 rounded-lg border border-input bg-transparent px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" placeholder="e.g. iptv, health, ai..." value={keyword} onChange={e => setKeyword(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Target Niche</label>
            <select className="w-full h-9 rounded-lg border border-input bg-transparent px-3 text-sm focus-visible:outline-none" value={selectedNiche} onChange={e => setSelectedNiche(e.target.value)}>
              <option value="">All Niches</option>
              {niches.map(n => <option key={n.slug} value={n.slug}>{NICHE_ICONS[n.slug] ?? "🏷"} {n.displayName}</option>)}
              {allNiches.filter(n => !niches.find(nn => nn.slug === n)).map(n => <option key={n} value={n!}>{n}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Max Bid</label>
              <span className="text-xs font-bold text-primary">${maxBidFilter[0]}</span>
            </div>
            <Slider min={5} max={1000} step={5} value={maxBidFilter} onValueChange={v => setMaxBidFilter(v as number[])} />
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Min Opportunity</label>
              <span className="text-xs font-bold text-primary">{minScore[0]}</span>
            </div>
            <Slider min={0} max={100} step={5} value={minScore} onValueChange={v => setMinScore(v as number[])} />
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4 mt-4 pt-4 border-t border-border">
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Ending Within</label>
            <div className="flex gap-1">
              {HOURS_FILTERS.map(f => (
                <button key={f.value} onClick={() => setHoursFilter(f.value)} className={`px-3 py-1 text-xs rounded-lg font-medium border transition-colors ${hoursFilter === f.value ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}>{f.label}</button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Sort By</label>
              <select className="h-8 rounded-lg border border-input bg-transparent px-2 text-xs focus-visible:outline-none" value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)}>
                <option value="opportunity">🎯 Opportunity</option>
                <option value="score">📊 Domain Score</option>
                <option value="price">💰 Lowest Price</option>
                <option value="ending">⏱ Ending Soon</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={autoWatch} onCheckedChange={setAutoWatch} id="auto-watch" />
              <label htmlFor="auto-watch" className="text-xs font-medium cursor-pointer">Auto-Watch ≥ 70</label>
            </div>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="font-semibold">Auction Opportunities</h2>
            <span className="text-xs text-muted-foreground">{filtered.length} results · ${totalValue.toLocaleString()} total value</span>
          </div>
          {hot > 0 && <span className="text-xs font-bold text-orange-400 bg-orange-500/10 border border-orange-500/30 px-3 py-1 rounded-full">🔥 {hot} hot picks</span>}
        </div>

        {loading && auctions.length === 0 && (
          <div className="flex flex-col items-center justify-center p-16 gap-4 text-muted-foreground">
            <div className="h-10 w-10 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            <div className="text-sm">Fetching live GoDaddy auctions…</div>
            <div className="text-xs">Scoring against your active niches</div>
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center p-16 gap-3 text-center">
            <div className="text-4xl">🏷️</div>
            <div className="font-semibold">No auctions match your filters</div>
            <p className="text-sm text-muted-foreground max-w-sm">Try relaxing your filters, or GoDaddy may be rate-limiting. Click Refresh to retry.</p>
            <p className="text-xs text-muted-foreground">Add GoDaddy API credentials in <a href="/settings" className="text-primary underline">Settings</a> for reliable live data.</p>
          </div>
        )}

        {filtered.length > 0 && (
          <div className="divide-y divide-border">
            {filtered.map(auction => {
              const isWatched = watched.some(w => w.listingId === auction.listingId);
              const isExpanded = expandedId === auction.listingId;
              const myBid = customBids[auction.listingId] ?? auction.maxBid;
              const roi = auction.domainScore > 0 ? ((auction.domainScore / Math.max(1, auction.currentBid)) * 10).toFixed(1) : "—";

              return (
                <div key={auction.listingId} className={`transition-colors ${isWatched ? "bg-blue-500/5" : "hover:bg-muted/20"}`}>
                  <div className="px-5 py-4 flex items-center gap-4">
                    <ScoreDial score={auction.opportunityScore} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold">{auction.domain}</span>
                        <OpportunityBadge score={auction.opportunityScore} />
                        {auction.niche && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-primary/15 text-primary">
                            {NICHE_ICONS[auction.niche] ?? "🏷"} {auction.niche}
                          </span>
                        )}
                        {auction.bidCount === 0 && <span className="text-[10px] font-bold text-green-400 bg-green-500/10 px-2 py-0.5 rounded border border-green-500/20">⚡ NO BIDS</span>}
                        {isWatched && <span className="text-[10px] font-bold text-blue-400">👁 WATCHING</span>}
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground flex-wrap">
                        <span>Domain score: <strong className="text-foreground">{auction.domainScore}</strong></span>
                        <span>Bids: <strong className="text-foreground">{auction.bidCount}</strong></span>
                        <span>ROI index: <strong className={parseFloat(roi as string) >= 5 ? "text-green-400" : "text-foreground"}>{roi}x</strong></span>
                        {auction.reason && <span className="italic truncate max-w-xs">{auction.reason}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 flex-shrink-0">
                      <div className="text-right">
                        <div className="text-lg font-bold text-green-400">${auction.currentBid.toFixed(0)}</div>
                        <div className="text-xs text-muted-foreground">current bid</div>
                      </div>
                      <Countdown hours={auction.hoursRemaining} />
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          className="h-8 w-20 rounded-lg border border-input bg-transparent px-2 text-sm text-center font-mono focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                          value={myBid}
                          onChange={e => setCustomBids(prev => ({ ...prev, [auction.listingId]: parseFloat(e.target.value) }))}
                          title="Your max bid"
                        />
                        <button
                          onClick={() => handleWatch(auction)}
                          disabled={isWatched || watching[auction.listingId]}
                          className={`h-8 px-3 rounded-lg text-xs font-bold border transition-colors ${isWatched ? "bg-blue-500/15 text-blue-400 border-blue-500/30" : "border-border hover:bg-muted text-muted-foreground hover:text-foreground"}`}
                        >
                          {watching[auction.listingId] ? "…" : isWatched ? "👁" : "Watch"}
                        </button>
                        <button
                          onClick={() => handleBid(auction)}
                          disabled={placing[auction.listingId]}
                          className="h-8 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 disabled:opacity-50 transition-colors"
                        >
                          {placing[auction.listingId] ? "…" : "Bid Now"}
                        </button>
                        <button onClick={() => setExpandedId(isExpanded ? null : auction.listingId)} className="h-8 w-8 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:bg-muted/30 text-xs">
                          {isExpanded ? "▲" : "▼"}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="px-5 pb-2">
                    <div className="h-1 bg-muted rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-500 ${auction.opportunityScore >= 60 ? "bg-green-500" : auction.opportunityScore >= 40 ? "bg-yellow-500" : "bg-red-500"}`} style={{ width: `${auction.opportunityScore}%` }} />
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="px-5 pb-5 border-t border-border bg-muted/10 pt-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[
                          { label: "Current Bid", val: `$${auction.currentBid}`, color: "text-green-400" },
                          { label: "My Max Bid", val: `$${myBid}`, color: "text-primary" },
                          { label: "Domain Score", val: `${auction.domainScore}/100`, color: "text-foreground" },
                          { label: "Opportunity", val: `${auction.opportunityScore}/100`, color: auction.opportunityScore >= 70 ? "text-orange-400" : "text-foreground" },
                        ].map(s => (
                          <div key={s.label} className="bg-card border rounded-xl p-3">
                            <div className="text-xs text-muted-foreground">{s.label}</div>
                            <div className={`text-lg font-bold mt-0.5 ${s.color}`}>{s.val}</div>
                          </div>
                        ))}
                      </div>
                      {auction.reason && (
                        <div className="mt-3 text-xs bg-primary/5 border border-primary/20 rounded-lg px-4 py-2.5 text-muted-foreground">
                          <span className="font-semibold text-foreground">Scoring factors: </span>{auction.reason}
                        </div>
                      )}
                      <div className="mt-3 flex gap-2">
                        <a href={`https://auctions.godaddy.com/trpItemListing.aspx?miid=${auction.listingId}`} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline font-semibold">
                          🔗 View on GoDaddy →
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
