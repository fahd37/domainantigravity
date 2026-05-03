"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

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
  { label: "Ending Soon", value: 2 },
];

function HoursCountdown({ hours }: { hours: number }) {
  const h = Math.floor(hours);
  const m = Math.floor((hours - h) * 60);
  const urgent = hours < 6;
  const critical = hours < 2;
  return (
    <span className={`font-mono text-sm font-bold ${critical ? "text-red-500 animate-pulse" : urgent ? "text-yellow-500" : "text-green-500"}`}>
      {h}h {m}m
    </span>
  );
}

function ScoreBar({ score, max = 100 }: { score: number; max?: number }) {
  const pct = Math.min(100, (score / max) * 100);
  const color = score >= 60 ? "bg-green-500" : score >= 40 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 bg-muted rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-semibold">{score}</span>
    </div>
  );
}

export default function AuctionsPage() {
  const [auctions, setAuctions] = useState<AuctionResult[]>([]);
  const [watched, setWatched] = useState<WatchedAuction[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState("");
  const [maxBidFilter, setMaxBidFilter] = useState([200]);
  const [hoursFilter, setHoursFilter] = useState(999);
  const [autoWatch, setAutoWatch] = useState(false);
  const [customBids, setCustomBids] = useState<Record<string, number>>({});
  const [placing, setPlacing] = useState<Record<string, boolean>>({});

  const fetchAuctions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/auctions");
      const json = await res.json();
      if (json.auctions) setAuctions(json.auctions);
      if (json.watched) setWatched(json.watched);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAuctions();
    const id = setInterval(fetchAuctions, 5 * 60 * 1000); // refresh every 5m
    return () => clearInterval(id);
  }, [fetchAuctions]);

  const handleWatch = async (auction: AuctionResult) => {
    try {
      await fetch("/api/auctions/watch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domain: auction.domain,
          listingId: auction.listingId,
          currentBid: auction.currentBid,
          maxBid: customBids[auction.listingId] ?? auction.maxBid,
          bidCount: auction.bidCount,
          hoursRemaining: auction.hoursRemaining,
          opportunityScore: auction.opportunityScore,
        }),
      });
      await fetchAuctions();
    } catch (e) {
      console.error(e);
    }
  };

  const handleBidNow = async (auction: AuctionResult) => {
    setPlacing(p => ({ ...p, [auction.listingId]: true }));
    try {
      const res = await fetch("/api/auctions/bid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listingId: auction.listingId,
          bidAmount: customBids[auction.listingId] ?? auction.currentBid + 1,
        }),
      });
      const data = await res.json();
      if (!data.success) alert(`Bid failed: ${data.error || "Unknown error"}`);
      else alert(`Bid placed: $${data.newBid}`);
    } finally {
      setPlacing(p => ({ ...p, [auction.listingId]: false }));
    }
  };

  // Apply filters
  const filtered = auctions.filter(a => {
    if (keyword && !a.domain.toLowerCase().includes(keyword.toLowerCase())) return false;
    if (a.currentBid > maxBidFilter[0]) return false;
    if (a.hoursRemaining > hoursFilter) return false;
    return true;
  }).sort((a, b) => b.opportunityScore - a.opportunityScore);

  return (
    <div className="flex flex-col gap-6 pb-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">GoDaddy Auctions</h1>
        <p className="text-muted-foreground mt-2">
          Live auction opportunities scored against your niche criteria — with sniper auto-bidding.
        </p>
      </div>

      {/* Active Watches Panel */}
      {watched.length > 0 && (
        <div className="rounded-xl border bg-card shadow-sm">
          <div className="p-4 border-b flex items-center justify-between">
            <h2 className="font-semibold text-sm">
              Active Watches
              <span className="ml-2 text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">{watched.length}</span>
            </h2>
          </div>
          <div className="divide-y">
            {watched.map(w => (
              <div key={w.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <div>
                  <span className="font-medium">{w.domain}</span>
                  <span className={`ml-2 text-xs px-1.5 py-0.5 rounded font-bold ${
                    w.status === "WATCHING" ? "bg-blue-500/20 text-blue-500" :
                    w.status === "WON" ? "bg-green-500/20 text-green-500" :
                    "bg-red-500/20 text-red-500"
                  }`}>{w.status}</span>
                </div>
                <div className="flex items-center gap-4 text-muted-foreground">
                  <span>Current: <strong className="text-foreground">${w.currentBid}</strong></span>
                  <span>Max: <strong className="text-foreground">${w.maxBid}</strong></span>
                  <HoursCountdown hours={w.hoursRemaining} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div className="rounded-xl border bg-card shadow-sm p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1.5 flex-1 min-w-[200px]">
            <Label className="text-xs">Keyword Filter</Label>
            <input
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              placeholder="e.g. seo, health, finance..."
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
            />
          </div>

          <div className="space-y-1.5 w-52">
            <div className="flex justify-between">
              <Label className="text-xs">Max Bid</Label>
              <span className="text-xs text-muted-foreground">${maxBidFilter[0]}</span>
            </div>
            <Slider min={5} max={200} step={5} value={maxBidFilter} onValueChange={v => setMaxBidFilter(v as number[])} />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Ending Within</Label>
            <div className="flex gap-1">
              {HOURS_FILTERS.map(f => (
                <button
                  key={f.value}
                  onClick={() => setHoursFilter(f.value)}
                  className={`px-3 py-1.5 text-xs rounded-md font-medium border transition-colors ${
                    hoursFilter === f.value ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 pb-0.5">
            <Switch checked={autoWatch} onCheckedChange={setAutoWatch} id="auto-watch" />
            <Label htmlFor="auto-watch" className="text-xs cursor-pointer">Auto-Watch ≥ threshold</Label>
          </div>

          <Button size="sm" variant="outline" onClick={fetchAuctions} disabled={loading}>
            {loading ? "Loading..." : "Refresh"}
          </Button>
        </div>
      </div>

      {/* Results Table */}
      <div className="rounded-xl border bg-card shadow-sm">
        <div className="p-4 border-b">
          <h2 className="font-semibold text-sm">
            Auction Opportunities
            <span className="ml-2 text-xs text-muted-foreground">{filtered.length} results</span>
          </h2>
        </div>

        {loading && auctions.length === 0 && (
          <div className="flex items-center justify-center p-16 text-muted-foreground text-sm animate-pulse">
            Fetching live auctions from GoDaddy...
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center p-16 gap-3 text-muted-foreground border-dashed border-2 border-muted m-4 rounded-lg">
            <p className="text-sm font-medium">No auctions found</p>
            <p className="text-xs">GoDaddy may be blocking scraping — add GoDaddy API credentials in Settings for reliable results.</p>
          </div>
        )}

        {filtered.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b">
                <tr>
                  <th className="px-4 py-3 font-medium">Domain</th>
                  <th className="px-4 py-3 font-medium">Score</th>
                  <th className="px-4 py-3 font-medium">Current Bid</th>
                  <th className="px-4 py-3 font-medium">Bids</th>
                  <th className="px-4 py-3 font-medium">Time Left</th>
                  <th className="px-4 py-3 font-medium">Opportunity</th>
                  <th className="px-4 py-3 font-medium">My Max Bid</th>
                  <th className="px-4 py-3 font-medium text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(auction => {
                  const isWatched = watched.some(w => w.listingId === auction.listingId);
                  return (
                    <tr key={auction.listingId} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium">{auction.domain}</div>
                        <div className="text-xs text-muted-foreground">{auction.reason}</div>
                      </td>
                      <td className="px-4 py-3">
                        <ScoreBar score={auction.domainScore} />
                      </td>
                      <td className="px-4 py-3 font-semibold text-green-500">
                        ${auction.currentBid.toFixed(0)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                          auction.bidCount === 0 ? "bg-green-500/20 text-green-500" :
                          auction.bidCount <= 2 ? "bg-yellow-500/20 text-yellow-500" :
                          "bg-muted text-muted-foreground"
                        }`}>
                          {auction.bidCount === 0 ? "⚡ 0 bids" : `${auction.bidCount} bids`}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <HoursCountdown hours={auction.hoursRemaining} />
                      </td>
                      <td className="px-4 py-3">
                        <ScoreBar score={auction.opportunityScore} />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          className="h-8 w-20 rounded-md border border-input bg-transparent px-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                          value={customBids[auction.listingId] ?? auction.maxBid}
                          onChange={e => setCustomBids(prev => ({ ...prev, [auction.listingId]: parseFloat(e.target.value) }))}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1 justify-center">
                          <Button
                            size="sm"
                            variant={isWatched ? "secondary" : "outline"}
                            onClick={() => handleWatch(auction)}
                            disabled={isWatched}
                          >
                            {isWatched ? "👁 Watching" : "Watch"}
                          </Button>
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => handleBidNow(auction)}
                            disabled={placing[auction.listingId]}
                          >
                            {placing[auction.listingId] ? "Bidding..." : "Bid Now"}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
