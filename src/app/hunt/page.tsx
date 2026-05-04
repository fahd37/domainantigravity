"use client";

import React, { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { ChevronDown, ChevronUp } from "lucide-react";

interface HuntResult {
  domain: string;
  total: number;
  recommendation: 'buy' | 'watch' | 'reject';
  filterReason?: string;
  ageYears?: number;
  tfCfRatio?: number;
  googleIndexed?: boolean;
  googlePageCount?: number;
  matchedNiche?: string;
  historicalKeywords?: Array<{keyword: string, searchVolume: number, position: number}>;
  parasiteReadiness?: 'HIGH' | 'MEDIUM' | 'LOW';
  isToxic?: boolean;
  breakdown?: {
    googleIndex: number;
    topicalAuthority: number;
    anchorRelevance: number;
    keywordHistory: number;
    age: number;
  };
}

export default function HuntPage() {
  const searchParams = useSearchParams();
  const [niches, setNiches] = useState<{slug: string; displayName: string; active: boolean}[]>([]);
  const [selectedNiche, setSelectedNiche] = useState<string>("");
  const [domainInput, setDomainInput] = useState("");
  const [threshold, setThreshold] = useState([60]);
  const [autoBuy, setAutoBuy] = useState(false);
  const [isScoring, setIsScoring] = useState(false);
  const [results, setResults] = useState<HuntResult[]>([]);
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [intelligenceBanner, setIntelligenceBanner] = useState<{niche: string; successRate?: number}|null>(null);
  const [missingApis, setMissingApis] = useState<{dfs: boolean; namecheap: boolean}>({ dfs: false, namecheap: false });
  const [sources, setSources] = useState({
    expiredDomains: false,
    godaddy: false,
    manual: true
  });

  useEffect(() => {
    fetch("/api/niches")
      .then(res => res.json())
      .then(json => {
        if (json.data) setNiches(json.data.filter((n: {active: boolean}) => n.active));
      })
      .catch(console.error);

    fetch("/api/settings")
      .then(res => res.json())
      .then(json => {
        if (json.data) {
          console.log('Settings keys:', Object.keys(json.data));
          // Keys match what settings-form.tsx saves:
          // dfs_email / dfs_password for DataForSEO
          // nc_api_user / nc_api_key for Namecheap
          const hasDfs = !!(json.data.dfs_email || json.data.dataForSeoEmail) &&
                         !!(json.data.dfs_password || json.data.dataForSeoPassword);
          const hasNc  = !!(json.data.nc_api_user || json.data.namecheapUser) &&
                         !!(json.data.nc_api_key  || json.data.namecheapApiKey);
          setMissingApis({ dfs: !hasDfs, namecheap: !hasNc });
        }
      })
      .catch(console.error);
  }, []);

  // Read URL params from Intelligence page
  useEffect(() => {
    const niche = searchParams.get('niche');
    const thresh = searchParams.get('threshold');
    const source = searchParams.get('source');
    if (niche) setSelectedNiche(niche);
    if (thresh) setThreshold([parseInt(thresh)]);
    if (source === 'intelligence' && niche) {
      fetch(`/api/niche-intelligence/${niche}`)
        .then(r => r.json())
        .then(j => {
          if (j.niche) setIntelligenceBanner({ niche: j.niche.displayName, successRate: j.niche.parasiteSuccessRate });
        })
        .catch(() => {});
    }
  }, [searchParams]);

  const handleStartHunt = async () => {
    if (!domainInput.trim()) return;
    
    setIsScoring(true);
    setResults([]);
    setExpandedRows({});
    
    const domains = domainInput
      .split("\n")
      .map(d => d.trim().toLowerCase())
      .filter(d => d.length > 0 && d.includes('.'));
      
    if (domains.length === 0) {
      setIsScoring(false);
      return;
    }

    try {
      const res = await fetch("/api/score-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domains, nicheSlug: selectedNiche || undefined, autoBuy })
      });
      
      const json = await res.json();
      if (json.results) {
        setResults(json.results);

        // Process auto-buy
        if (autoBuy) {
          json.results.forEach((r: HuntResult) => {
            if (r.total >= threshold[0] && r.recommendation === 'buy') {
              handleBuy(r.domain, r.total, selectedNiche);
            }
          });
        }
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsScoring(false);
    }
  };

  const handleBuy = async (domain: string, score: number, niche: string) => {
    try {
      const res = await fetch("/api/purchase/buy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain, score, niche })
      });
      const data = await res.json();
      if (data.error) {
        alert(`Failed to queue ${domain}: ${data.error}`);
      } else {
        alert(`${domain} queued for purchase!`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const toggleRow = (domain: string) => {
    setExpandedRows(prev => ({ ...prev, [domain]: !prev[domain] }));
  };

  const domainsScanned = results.length;
  const passedGoogle = results.filter(r => r.googleIndexed).length;
  const scoredHigh = results.filter(r => r.total >= 60).length;
  const readyToBuy = results.filter(r => r.recommendation === 'buy').length;

  return (
    <div className="flex flex-col gap-6 pb-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Active Hunt</h1>
        <p className="text-muted-foreground mt-2">
          Start and monitor live crawler instances for Parasite SEO opportunities.
        </p>
      </div>

      {intelligenceBanner && (
        <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🎯</span>
            <div>
              <div className="font-semibold text-green-400">Hunting {intelligenceBanner.niche}</div>
              <div className="text-xs text-muted-foreground">From Intelligence Database · Estimated {intelligenceBanner.successRate}% success rate · Threshold pre-set to optimal level</div>
            </div>
          </div>
          <button onClick={() => setIntelligenceBanner(null)} className="text-muted-foreground hover:text-foreground">✕</button>
        </div>
      )}

      {missingApis.dfs && (
        <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <div className="font-semibold text-yellow-500">DataForSEO not configured</div>
              <div className="text-sm text-muted-foreground">SEO scores will be incomplete</div>
            </div>
          </div>
          <a href="/settings" className="text-sm text-yellow-500 hover:underline font-semibold">Configure in Settings →</a>
        </div>
      )}

      {missingApis.namecheap && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <div className="font-semibold text-red-500">Namecheap not configured</div>
              <div className="text-sm text-muted-foreground">Auto-buy disabled</div>
            </div>
          </div>
          <a href="/settings" className="text-sm text-red-500 hover:underline font-semibold">Configure in Settings →</a>
        </div>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Controls Column */}
        <div className="col-span-1 flex flex-col gap-6">
          <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-6 space-y-6">
            
            <div className="space-y-3">
              <Label className="text-base font-semibold">Sources</Label>
              <div className="flex flex-col gap-2">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="src-expired" 
                    checked={sources.expiredDomains} 
                    onCheckedChange={(c) => setSources(s => ({...s, expiredDomains: !!c}))} 
                  />
                  <Label htmlFor="src-expired">ExpiredDomains.net</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="src-godaddy" 
                    checked={sources.godaddy} 
                    onCheckedChange={(c) => setSources(s => ({...s, godaddy: !!c}))} 
                  />
                  <Label htmlFor="src-godaddy">GoDaddy Auctions</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="src-manual" 
                    checked={sources.manual} 
                    onCheckedChange={(c) => setSources(s => ({...s, manual: !!c}))} 
                  />
                  <Label htmlFor="src-manual">Manual Entry</Label>
                </div>
              </div>
            </div>

            {sources.manual && (
              <div className="space-y-3">
                <Label className="text-base font-semibold">Manual Domains</Label>
                <textarea 
                  className="flex min-h-[120px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  placeholder="example.com&#10;test.net"
                  value={domainInput}
                  onChange={e => setDomainInput(e.target.value)}
                />
              </div>
            )}

            <div className="space-y-3">
              <Label className="text-base font-semibold">Target Niche</Label>
              <select 
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                value={selectedNiche}
                onChange={e => setSelectedNiche(e.target.value)}
              >
                <option value="">Any Niche</option>
                {niches.map(n => (
                  <option key={n.slug} value={n.slug}>{n.displayName}</option>
                ))}
              </select>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between">
                <Label className="text-base font-semibold">Buy Threshold</Label>
                <span className="text-sm font-medium">{threshold[0]}</span>
              </div>
              <Slider 
                min={0} max={100} step={1}
                value={threshold} 
                onValueChange={(val) => setThreshold(val as number[])}
              />
            </div>

            <div className="flex items-center justify-between border-t pt-4">
              <div className="space-y-0.5">
                <Label className="text-base font-semibold">Auto-Buy Domains</Label>
                <p className="text-xs text-muted-foreground">Automatically purchase if score {'>'}= {threshold[0]}</p>
              </div>
              <Switch checked={autoBuy} onCheckedChange={setAutoBuy} />
            </div>

            <Button 
              className="w-full font-bold" 
              size="lg" 
              onClick={handleStartHunt}
              disabled={isScoring || (!sources.manual && !sources.expiredDomains && !sources.godaddy)}
            >
              {isScoring ? "Scoring Domains..." : "Start Hunt"}
            </Button>
          </div>
        </div>

        {/* Results Column */}
        <div className="col-span-1 lg:col-span-2 flex flex-col gap-4">
          
          {results.length > 0 && (
            <div className="rounded-xl border bg-primary/10 text-primary p-4 flex items-center justify-center font-medium gap-2">
              <span>{domainsScanned} domains scanned</span>
              <span>→</span>
              <span>{passedGoogle} passed Google index check</span>
              <span>→</span>
              <span>{scoredHigh} scored ≥ 60</span>
              <span>→</span>
              <span className="font-bold">{readyToBuy} ready to buy</span>
            </div>
          )}

          <div className="rounded-xl border bg-card text-card-foreground shadow-sm">
            <div className="p-6">
              <h2 className="text-xl font-semibold mb-4">Parasite SEO Results</h2>
              
              {isScoring && (
                <div className="flex items-center justify-center p-8 text-muted-foreground animate-pulse">
                  Analyzing domain metrics...
                </div>
              )}

              {!isScoring && results.length === 0 && (
                <div className="text-center p-12 text-muted-foreground border-dashed border rounded-lg">
                  No results yet. Enter domains and start the hunt.
                </div>
              )}

              {results.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b">
                      <tr>
                        <th className="px-4 py-3 font-medium">Domain</th>
                        <th className="px-4 py-3 font-medium">Score</th>
                        <th className="px-4 py-3 font-medium">Google Status</th>
                        <th className="px-4 py-3 font-medium">Topical Match</th>
                        <th className="px-4 py-3 font-medium">Top Keyword</th>
                        <th className="px-4 py-3 font-medium">TF/CF</th>
                        <th className="px-4 py-3 font-medium">Readiness</th>
                        <th className="px-4 py-3 font-medium text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.map((res, i) => {
                        const topKw = res.historicalKeywords?.[0];
                        return (
                          <React.Fragment key={i}>
                            <tr className="border-b last:border-0 hover:bg-muted/30 group">
                              <td className="px-4 py-3 font-medium text-foreground flex items-center gap-2">
                                <button onClick={() => toggleRow(res.domain)} className="text-muted-foreground hover:text-foreground">
                                  {expandedRows[res.domain] ? <ChevronUp className="h-4 w-4"/> : <ChevronDown className="h-4 w-4"/>}
                                </button>
                                {res.domain}
                                {res.filterReason && res.total === 0 && (
                                  <div className="text-[10px] text-destructive max-w-[150px] truncate" title={res.filterReason}>
                                    Filtered
                                  </div>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <span className={`font-bold text-lg ${res.total >= 60 ? 'text-green-500' : res.total >= 40 ? 'text-yellow-500' : 'text-red-500'}`}>
                                    {res.total || 0}
                                  </span>
                                  <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                                    <div className={`h-full ${res.total >= 60 ? 'bg-green-500' : res.total >= 40 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{width: `${res.total}%`}} />
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                {res.googleIndexed ? (
                                  <span className="text-green-600 font-medium">✅ {res.googlePageCount} pages indexed</span>
                                ) : (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/20 text-red-500 uppercase">❌ Deindexed</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-xs">
                                {res.matchedNiche && res.matchedNiche !== "unknown" ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded font-bold bg-blue-500/20 text-blue-500">
                                    {res.matchedNiche} Match
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">None</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-xs">
                                {topKw ? (
                                  <div className="flex flex-col">
                                    <span className="font-semibold">{topKw.keyword}</span>
                                    <span className="text-muted-foreground">{topKw.searchVolume?.toLocaleString()} / mo</span>
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                {res.tfCfRatio != null ? (
                                  <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                                    res.tfCfRatio >= 0.5 ? 'bg-green-500/20 text-green-500' : res.tfCfRatio >= 0.3 ? 'bg-yellow-500/20 text-yellow-500' : 'bg-red-500/20 text-red-500'
                                  }`}>
                                    {res.tfCfRatio.toFixed(2)}
                                  </span>
                                ) : '—'}
                              </td>
                              <td className="px-4 py-3">
                                {res.parasiteReadiness ? (
                                  <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                                    res.parasiteReadiness === 'HIGH' ? 'bg-green-500/20 text-green-500' :
                                    res.parasiteReadiness === 'MEDIUM' ? 'bg-yellow-500/20 text-yellow-500' :
                                    'bg-red-500/20 text-red-500'
                                  }`}>
                                    {res.parasiteReadiness}
                                  </span>
                                ) : '—'}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <Button
                                  variant={res.recommendation === 'buy' ? "default" : res.recommendation === 'watch' ? "secondary" : "outline"}
                                  size="sm"
                                  onClick={() => handleBuy(res.domain, res.total, selectedNiche)}
                                  disabled={res.recommendation === 'reject' || res.total === 0}
                                >
                                  {res.recommendation === 'buy' ? 'Buy' : res.recommendation === 'watch' ? 'Watch' : 'Reject'}
                                </Button>
                              </td>
                            </tr>
                            {expandedRows[res.domain] && (
                              <tr className="bg-muted/10 border-b">
                                <td colSpan={8} className="px-10 py-4">
                                  <div className="space-y-2">
                                    <h4 className="font-semibold text-sm">Keyword Targets</h4>
                                    {res.historicalKeywords && res.historicalKeywords.length > 0 ? (
                                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                        {res.historicalKeywords.slice(0, 5).map((k, idx) => (
                                          <div key={idx} className="bg-card border rounded p-2 text-xs">
                                            <div className="font-semibold truncate">{k.keyword}</div>
                                            <div className="text-muted-foreground flex justify-between mt-1">
                                              <span>Vol: {k.searchVolume?.toLocaleString()}</span>
                                              <span>Pos: {k.position}</span>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <p className="text-xs text-muted-foreground">No historical keywords found. Will fallback to niche keywords.</p>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
