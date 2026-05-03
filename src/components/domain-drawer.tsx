"use client";

import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

interface TopReferrer {
  domain: string;
  alive: boolean;
  indexed: boolean;
  rank: number;
  backlinks: number;
  isRelevant: boolean;
}

interface Domain {
  id: string;
  name: string;
  niche: string;
  tld: string;
  score?: number;
  status: string;
  dr?: number;
  referringDomains?: number;
  waybackPages?: number;
  price?: number;
  boughtAt?: string;
  filterReason?: string;
  createdAt: string;
  scoreBreakdown?: Record<string, number>;
  // Link quality fields
  linkQualityScore?: number;
  aliveRatio?: number;
  indexedRatio?: number;
  relevanceRatio?: number;
  linkVelocityRisk?: boolean;
  geoDistribution?: number;
  linkVerdict?: string;
  topReferrers?: TopReferrer[];
  parasiteScore?: number;
  parasiteReadiness?: string;
  googleIndexed?: boolean;
  googlePageCount?: number;
  anchorRelevanceRatio?: number;
  historicalKeywords?: Array<{keyword: string, searchVolume: number, position: number}>;
}

type Tab = "breakdown" | "details" | "links";

function Ratio({ label, value, color }: { label: string; value?: number; color: string }) {
  const pct = Math.round((value ?? 0) * 100);
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold">{pct}%</span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function VerdictBadge({ verdict }: { verdict?: string }) {
  const colors: Record<string, string> = {
    clean: "bg-green-500/20 text-green-500",
    suspicious: "bg-yellow-500/20 text-yellow-500",
    toxic: "bg-red-500/20 text-red-500",
  };
  const label = verdict ?? "unknown";
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${colors[label] ?? "bg-muted text-muted-foreground"}`}>
      {label}
    </span>
  );
}

export function DomainDrawer({ domain, open, onOpenChange, onBuy, onReject }: {
  domain: Domain | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onBuy: (d: Domain) => void;
  onReject: (d: Domain) => void;
}) {
  const [tab, setTab] = useState<Tab>("breakdown");
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<{ verdict?: string; linkQualityScore?: number } | null>(null);

  if (!domain) return null;
  const breakdown = typeof domain.scoreBreakdown === "string"
    ? JSON.parse(domain.scoreBreakdown)
    : (domain.scoreBreakdown || {});

  const lqs = scanResult?.linkQualityScore ?? domain.linkQualityScore;
  const verdict = scanResult?.verdict ?? domain.linkVerdict;
  const lqColor = (lqs ?? 0) >= 60 ? "text-green-500" : (lqs ?? 0) >= 35 ? "text-yellow-500" : "text-red-500";

  const runQualityScan = async () => {
    setScanning(true);
    try {
      const res = await fetch("/api/quality-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domainIds: [domain.id] }),
      });
      const data = await res.json();
      if (data.results?.[0]) setScanResult(data.results[0]);
    } finally {
      setScanning(false);
    }
  };

  const TABS: { id: Tab; label: string }[] = [
    { id: "breakdown", label: "Score" },
    { id: "details", label: "Details" },
    { id: "links", label: "Link Profile" },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[400px] sm:w-[560px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-2xl font-bold">{domain.name}</SheetTitle>
          <SheetDescription>
            {domain.niche} • {domain.tld} • Added {new Date(domain.createdAt).toLocaleDateString()}
          </SheetDescription>
        </SheetHeader>

        {/* Parasite Readiness Card */}
        {domain.parasiteReadiness && (
          <div className="mt-4 p-4 rounded-xl border bg-card shadow-sm space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <span className="font-bold text-sm tracking-wide flex items-center gap-2">
                🎯 PARASITE READINESS:
                <span className={`px-2 py-0.5 rounded text-xs text-white ${
                  domain.parasiteReadiness === 'HIGH' ? 'bg-green-500' :
                  domain.parasiteReadiness === 'MEDIUM' ? 'bg-yellow-500' : 'bg-red-500'
                }`}>
                  {domain.parasiteReadiness}
                </span>
              </span>
            </div>
            <div className="grid grid-cols-2 gap-y-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground w-16">Google:</span>
                <span className="font-medium">{domain.googleIndexed ? `✅ ${domain.googlePageCount} pages indexed` : '❌ Deindexed'}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground w-16">Topic:</span>
                <span className="font-medium">✅ {domain.niche} match</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground w-16">Anchors:</span>
                <span className="font-medium">{domain.anchorRelevanceRatio !== undefined ? `✅ ${Math.round(domain.anchorRelevanceRatio * 100)}% relevant` : '—'}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground w-16">History:</span>
                <span className="font-medium">
                  {domain.historicalKeywords?.[0] ? `✅ Ranked for "${domain.historicalKeywords[0].keyword}"` : '❌ No history'}
                </span>
              </div>
            </div>

            <div className="bg-muted/50 p-3 rounded-lg space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Top Keywords To Target</h4>
              <ul className="text-sm space-y-1">
                {(domain.historicalKeywords || []).slice(0, 3).map((k, i) => (
                  <li key={i} className="flex justify-between">
                    <span className="font-medium">• &quot;{k.keyword}&quot;</span>
                    <span className="text-muted-foreground text-xs">({k.searchVolume?.toLocaleString()}/mo)</span>
                  </li>
                ))}
                {(!domain.historicalKeywords || domain.historicalKeywords.length === 0) && (
                  <li className="text-muted-foreground text-xs italic">No historical keywords.</li>
                )}
              </ul>
            </div>

            <div className="flex justify-between items-center pt-2">
              <span className="text-sm font-medium">Est. time to rank:</span>
              <span className="text-sm font-bold text-blue-500">
                {!domain.googleIndexed ? "Never — do not buy" :
                 (domain.googlePageCount || 0) > 20 && (domain.historicalKeywords || []).length > 5 ? "3-7 days" :
                 (domain.googlePageCount || 0) >= 5 ? "1-2 weeks" :
                 "2-4 weeks"
                }
              </span>
            </div>
            <Button
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold"
              onClick={() => onBuy(domain)}
              disabled={domain.status === "BOUGHT" || domain.status === "QUEUED"}
            >
              Buy & Start Pipeline →
            </Button>
          </div>
        )}

        {/* Tab switcher */}
        <div className="flex gap-1 mt-4 p-1 bg-muted rounded-lg">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-colors ${
                tab === t.id ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="py-5 space-y-5">
          {/* TAB: Score Breakdown */}
          {tab === "breakdown" && (
            <div className="space-y-2 text-sm">
              <h3 className="font-semibold mb-2">Score Breakdown ({domain.score} pts)</h3>
              {[
                { label: `Wayback Snapshots (${domain.waybackPages || 0})`, key: "wayback", color: "text-blue-500" },
                { label: `SEO Metrics (DR ${domain.dr || 0}, RD ${domain.referringDomains || 0})`, key: "seo", color: "text-purple-500" },
                { label: "Niche Match", key: "niche", color: "text-green-500" },
                { label: "Recency Bonus", key: "age", color: "text-orange-500" },
                { label: "TLD Bonus", key: "tld", color: "text-yellow-500" },
                { label: "Domain Age Bonus", key: "domainAge", color: "text-pink-500" },
                { label: "Link Quality Bonus", key: "linkQuality", color: "text-cyan-500" },
              ].map(row => (
                <div key={row.key} className="flex justify-between items-center border-b pb-1">
                  <span>{row.label}</span>
                  <span className={`font-mono ${row.color}`}>+{breakdown[row.key] || 0} pts</span>
                </div>
              ))}
            </div>
          )}

          {/* TAB: Details */}
          {tab === "details" && (
            <div className="space-y-1 text-sm">
              <h3 className="font-semibold mb-2">Details & Timeline</h3>
              <ul className="space-y-1">
                <li>Status: <span className="font-bold">{domain.status}</span></li>
                {domain.filterReason && <li className="text-destructive">Filter: {domain.filterReason}</li>}
                {domain.boughtAt && <li>Bought: {new Date(domain.boughtAt).toLocaleString()}</li>}
                <li>Estimated Price: ${domain.price || "10.00"}</li>
                <li className="pt-2">
                  <a href={`https://web.archive.org/web/*/${domain.name}`} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline font-semibold">
                    View on Archive.org →
                  </a>
                </li>
              </ul>
            </div>
          )}

          {/* TAB: Link Profile */}
          {tab === "links" && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Link Profile</h3>
                <Button size="sm" variant="outline" onClick={runQualityScan} disabled={scanning}>
                  {scanning ? "Scanning..." : "🔍 Run Quality Check"}
                </Button>
              </div>

              {/* Quality score gauge */}
              <div className="flex items-center gap-5 p-4 rounded-xl bg-muted/40 border">
                <div className="text-center">
                  <div className={`text-4xl font-black ${lqColor}`}>{lqs ?? "—"}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Quality Score</div>
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Verdict</span>
                    <VerdictBadge verdict={verdict} />
                  </div>
                  {domain.linkVelocityRisk && (
                    <div className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                      <span className="text-xs text-red-500 font-medium">Link velocity spike detected</span>
                    </div>
                  )}
                  {(domain.geoDistribution ?? 0) > 0 && (
                    <div className="text-xs text-muted-foreground">
                      Links from <span className="font-semibold text-foreground">{domain.geoDistribution}</span> countries
                    </div>
                  )}
                </div>
              </div>

              {/* Ratio bars */}
              <div className="space-y-3">
                <Ratio label="Alive Referrers" value={domain.aliveRatio} color="bg-green-500" />
                <Ratio label="Indexed Referrers" value={domain.indexedRatio} color="bg-blue-500" />
                <Ratio label="Relevant (same niche)" value={domain.relevanceRatio} color="bg-purple-500" />
              </div>

              {/* Top referrers table */}
              {(domain.topReferrers?.length ?? 0) > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Top Referring Domains</h4>
                  <div className="rounded-lg border overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/50 border-b">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium">Domain</th>
                          <th className="px-3 py-2 text-center font-medium">Alive</th>
                          <th className="px-3 py-2 text-center font-medium">Indexed</th>
                          <th className="px-3 py-2 text-right font-medium">Rank</th>
                        </tr>
                      </thead>
                      <tbody>
                        {domain.topReferrers!.map((ref, i) => (
                          <tr key={i} className="border-b last:border-0 hover:bg-muted/20">
                            <td className="px-3 py-2 font-mono">{ref.domain}</td>
                            <td className="px-3 py-2 text-center">{ref.alive ? "✅" : "❌"}</td>
                            <td className="px-3 py-2 text-center">{ref.indexed ? "✅" : "❌"}</td>
                            <td className="px-3 py-2 text-right text-muted-foreground">{ref.rank || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {(domain.topReferrers?.length ?? 0) === 0 && !scanning && (
                <p className="text-xs text-muted-foreground text-center py-4">
                  Click &quot;Run Quality Check&quot; to analyze this domain&apos;s backlink profile.
                </p>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button
              className="w-full bg-green-600 hover:bg-green-700 text-white"
              onClick={() => onBuy(domain)}
              disabled={domain.status === "BOUGHT" || domain.status === "QUEUED"}
            >
              Manual Buy
            </Button>
            <Button
              className="w-full"
              variant="destructive"
              onClick={() => onReject(domain)}
              disabled={domain.status === "REJECTED" || domain.status === "BOUGHT"}
            >
              Reject
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
