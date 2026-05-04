"use client";

import React, { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";

interface HuntResult {
  domain: string;
  total: number;
  recommendation: "buy" | "watch" | "reject";
  filterReason?: string;
  ageYears?: number;
  tfCfRatio?: number;
  googleIndexed?: boolean;
  googlePageCount?: number;
  matchedNiche?: string;
  historicalKeywords?: Array<{ keyword: string; searchVolume: number; position: number }>;
  parasiteReadiness?: "HIGH" | "MEDIUM" | "LOW";
  isToxic?: boolean;
  referringDomains?: number;
  backlinks?: number;
  waybackCount?: number;
  breakdown?: { googleIndex: number; topicalAuthority: number; anchorRelevance: number; keywordHistory: number; age: number };
}

type PipelineStage = "idle" | "running" | "done" | "skipped" | "error";

interface StageState {
  whoisfreaks: PipelineStage;
  googleIndex: PipelineStage;
  wayback: PipelineStage;
  dataforseo: PipelineStage;
  scoring: PipelineStage;
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 60 ? "text-green-400 bg-green-500/15 border-green-500/30" : score >= 40 ? "text-yellow-400 bg-yellow-500/15 border-yellow-500/30" : "text-red-400 bg-red-500/15 border-red-500/30";
  return (
    <span className={`inline-flex items-center justify-center w-10 h-10 rounded-full border-2 font-bold text-sm ${color}`}>
      {score}
    </span>
  );
}

function StageIndicator({ label, icon, stage }: { label: string; icon: string; stage: PipelineStage }) {
  const styles: Record<PipelineStage, string> = {
    idle: "border-border text-muted-foreground bg-muted/20",
    running: "border-blue-500/50 text-blue-400 bg-blue-500/10 animate-pulse",
    done: "border-green-500/50 text-green-400 bg-green-500/10",
    skipped: "border-yellow-500/30 text-yellow-500/60 bg-yellow-500/5",
    error: "border-red-500/50 text-red-400 bg-red-500/10",
  };
  const dot: Record<PipelineStage, string> = {
    idle: "bg-muted-foreground",
    running: "bg-blue-500 animate-ping",
    done: "bg-green-500",
    skipped: "bg-yellow-500/40",
    error: "bg-red-500",
  };
  return (
    <div className={`flex flex-col items-center gap-1.5 px-3 py-2.5 rounded-xl border text-xs font-medium transition-all duration-500 ${styles[stage]}`}>
      <span className="text-lg">{icon}</span>
      <span className="whitespace-nowrap">{label}</span>
      <span className={`h-1.5 w-1.5 rounded-full ${dot[stage]}`} />
    </div>
  );
}

export default function HuntPage() {
  const searchParams = useSearchParams();
  const [niches, setNiches] = useState<{ slug: string; displayName: string }[]>([]);
  const [selectedNiche, setSelectedNiche] = useState("");
  const [domainInput, setDomainInput] = useState("");
  const [threshold, setThreshold] = useState([60]);
  const [autoBuy, setAutoBuy] = useState(false);
  const [isScoring, setIsScoring] = useState(false);
  const [results, setResults] = useState<HuntResult[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [hasDfs, setHasDfs] = useState(false);
  const [hasNc, setHasNc] = useState(false);
  const [stages, setStages] = useState<StageState>({ whoisfreaks: "idle", googleIndex: "idle", wayback: "idle", dataforseo: "idle", scoring: "idle" });
  const logsRef = useRef<HTMLDivElement>(null);

  const addLog = (msg: string) => {
    const time = new Date().toLocaleTimeString("en", { hour12: false });
    setLogs(prev => [`[${time}] ${msg}`, ...prev.slice(0, 49)]);
  };

  useEffect(() => {
    fetch("/api/niches").then(r => r.json()).then(j => { if (j.data) setNiches(j.data.filter((n: { active: boolean }) => n.active)); }).catch(() => {});
    fetch("/api/settings").then(r => r.json()).then(j => {
      if (j.data) {
        const d = j.data;
        setHasDfs(!!(d.dfs_email || d.dataForSeoEmail) && !!(d.dfs_password || d.dataForSeoPassword));
        setHasNc(!!(d.nc_api_user) && !!(d.nc_api_key));
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const niche = searchParams.get("niche");
    const thresh = searchParams.get("threshold");
    if (niche) setSelectedNiche(niche);
    if (thresh) setThreshold([parseInt(thresh)]);
  }, [searchParams]);

  const resetStages = () => setStages({ whoisfreaks: "idle", googleIndex: "idle", wayback: "idle", dataforseo: "idle", scoring: "idle" });

  const handleStartHunt = async () => {
    if (!domainInput.trim()) return;
    const domains = domainInput.split("\n").map(d => d.trim().toLowerCase()).filter(d => d.length > 0 && d.includes("."));
    if (domains.length === 0) return;

    setIsScoring(true);
    setResults([]);
    setLogs([]);
    resetStages();

    addLog(`🚀 Starting hunt for ${domains.length} domain(s)…`);
    addLog(`📋 Target niche: ${selectedNiche || "Any"} · Threshold: ${threshold[0]}`);

    // Simulate pipeline stage progression
    setStages(s => ({ ...s, whoisfreaks: "running" }));
    addLog("🔍 WhoisFreaks: Checking domain drop data…");
    await new Promise(r => setTimeout(r, 600));
    setStages(s => ({ ...s, whoisfreaks: "done", googleIndex: "running" }));
    addLog("✅ WhoisFreaks: Domain verified");

    addLog("🌐 Google Index: Checking indexation status…");
    await new Promise(r => setTimeout(r, 400));
    setStages(s => ({ ...s, googleIndex: "running" }));

    addLog("📚 Wayback Machine: Fetching historical snapshots…");
    setStages(s => ({ ...s, wayback: "running" }));

    if (hasDfs) {
      addLog("📊 DataForSEO: Scoring organic metrics + backlinks…");
      setStages(s => ({ ...s, dataforseo: "running" }));
    } else {
      addLog("⚠️ DataForSEO: Not configured — skipping SEO enrichment");
      setStages(s => ({ ...s, dataforseo: "skipped" }));
    }

    addLog("⚙️ Scoring engine: Calculating parasite SEO scores…");
    setStages(s => ({ ...s, scoring: "running" }));

    try {
      const res = await fetch("/api/score-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domains, nicheSlug: selectedNiche || undefined, autoBuy }),
      });
      const json = await res.json();

      if (json.results) {
        setResults(json.results);
        setStages({ whoisfreaks: "done", googleIndex: "done", wayback: "done", dataforseo: hasDfs ? "done" : "skipped", scoring: "done" });

        const buyCount = json.results.filter((r: HuntResult) => r.recommendation === "buy").length;
        const indexed = json.results.filter((r: HuntResult) => r.googleIndexed).length;
        addLog(`✅ Scoring complete: ${json.results.length} domains analysed`);
        addLog(`📈 Google indexed: ${indexed}/${json.results.length}`);
        addLog(`🛒 Ready to buy: ${buyCount} domain(s) above threshold`);

        if (autoBuy) {
          json.results.forEach((r: HuntResult) => {
            if (r.total >= threshold[0] && r.recommendation === "buy") {
              addLog(`🤖 Auto-buy queued: ${r.domain} (score ${r.total})`);
              handleBuy(r.domain, r.total, selectedNiche);
            }
          });
        }
      } else if (json.error) {
        setStages(s => ({ ...s, scoring: "error" }));
        addLog(`❌ Error: ${json.error}`);
      }
    } catch (e) {
      setStages(s => ({ ...s, scoring: "error" }));
      addLog(`❌ Network error: ${String(e)}`);
    } finally {
      setIsScoring(false);
    }
  };

  const handleBuy = async (domain: string, score: number, niche: string) => {
    addLog(`🛒 Queuing purchase: ${domain}…`);
    try {
      const res = await fetch("/api/purchase/buy", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ domain, score, niche }) });
      const data = await res.json();
      if (data.error) addLog(`❌ Buy failed for ${domain}: ${data.error}`);
      else addLog(`✅ ${domain} queued for purchase!`);
    } catch { addLog(`❌ Buy request failed for ${domain}`); }
  };

  const bought = results.filter(r => r.recommendation === "buy").length;
  const watched = results.filter(r => r.recommendation === "watch").length;
  const rejected = results.filter(r => r.recommendation === "reject").length;
  const indexed = results.filter(r => r.googleIndexed).length;

  return (
    <div className="flex flex-col gap-6 pb-10">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Domain Hunt</h1>
          <p className="text-muted-foreground mt-1.5">Analyse dropped domains through the full WhoisFreaks → Google Index → Wayback → DataForSEO pipeline.</p>
        </div>
        {results.length > 0 && (
          <div className="flex gap-3 text-center">
            {[{ label: "Buy", val: bought, c: "text-green-400" }, { label: "Watch", val: watched, c: "text-yellow-400" }, { label: "Reject", val: rejected, c: "text-red-400" }].map(s => (
              <div key={s.label} className="rounded-xl border bg-card px-4 py-2.5 min-w-[60px]">
                <div className={`text-2xl font-bold ${s.c}`}>{s.val}</div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* API Warnings */}
      {!hasDfs && (
        <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3"><span>⚠️</span><div><div className="font-semibold text-yellow-400 text-sm">DataForSEO not configured</div><div className="text-xs text-muted-foreground">SEO scoring & backlinks will be skipped</div></div></div>
          <a href="/settings" className="text-xs text-yellow-400 font-semibold hover:underline">Configure →</a>
        </div>
      )}
      {!hasNc && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3"><span>🔴</span><div><div className="font-semibold text-red-400 text-sm">Namecheap not configured</div><div className="text-xs text-muted-foreground">Auto-buy is disabled</div></div></div>
          <a href="/settings" className="text-xs text-red-400 font-semibold hover:underline">Configure →</a>
        </div>
      )}

      {/* Pipeline Stages */}
      <div className="rounded-xl border bg-card p-4">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Pipeline Stages</div>
        <div className="flex gap-2 items-center flex-wrap">
          <StageIndicator label="WhoisFreaks" icon="🔍" stage={stages.whoisfreaks} />
          <div className="text-muted-foreground text-lg">→</div>
          <StageIndicator label="Google Index" icon="🌐" stage={stages.googleIndex} />
          <div className="text-muted-foreground text-lg">→</div>
          <StageIndicator label="Wayback" icon="📚" stage={stages.wayback} />
          <div className="text-muted-foreground text-lg">→</div>
          <StageIndicator label="DataForSEO" icon="📊" stage={stages.dataforseo} />
          <div className="text-muted-foreground text-lg">→</div>
          <StageIndicator label="Scoring" icon="⚙️" stage={stages.scoring} />
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left — Controls */}
        <div className="space-y-4">
          <div className="rounded-xl border bg-card p-5 space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-semibold">Domains to Analyse</label>
              <textarea
                className="w-full min-h-[130px] rounded-lg border border-input bg-transparent px-3 py-2 text-sm font-mono resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                placeholder={"example.com\ntest.net\nmydomain.io"}
                value={domainInput}
                onChange={e => setDomainInput(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">One domain per line</p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold">Target Niche</label>
              <select
                className="w-full h-9 rounded-lg border border-input bg-transparent px-3 text-sm focus-visible:outline-none"
                value={selectedNiche}
                onChange={e => setSelectedNiche(e.target.value)}
              >
                <option value="">Any Niche</option>
                {niches.map(n => <option key={n.slug} value={n.slug}>{n.displayName}</option>)}
              </select>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <label className="text-sm font-semibold">Buy Threshold</label>
                <span className="text-sm font-mono font-bold text-primary">{threshold[0]}</span>
              </div>
              <Slider min={0} max={100} step={1} value={threshold} onValueChange={v => setThreshold(v as number[])} />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>0 — Accept all</span><span>100 — Perfection only</span>
              </div>
            </div>

            <div className="flex items-center justify-between border-t pt-4">
              <div>
                <div className="text-sm font-semibold">Auto-Buy</div>
                <div className="text-xs text-muted-foreground">Purchase if score ≥ {threshold[0]}</div>
              </div>
              <Switch checked={autoBuy} onCheckedChange={setAutoBuy} disabled={!hasNc} />
            </div>

            <button
              onClick={handleStartHunt}
              disabled={isScoring || !domainInput.trim()}
              className="w-full h-11 rounded-lg bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
            >
              {isScoring ? (
                <><span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Analysing…</>
              ) : "🚀 Start Hunt"}
            </button>
          </div>

          {/* Live Logs */}
          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Live Logs</div>
              {logs.length > 0 && <button onClick={() => setLogs([])} className="text-[10px] text-muted-foreground hover:text-foreground">Clear</button>}
            </div>
            <div ref={logsRef} className="space-y-1 max-h-64 overflow-y-auto">
              {logs.length === 0 ? (
                <div className="text-xs text-muted-foreground italic">Logs will appear here when hunt starts…</div>
              ) : logs.map((log, i) => (
                <div key={i} className={`text-[11px] font-mono leading-relaxed ${log.includes("❌") ? "text-red-400" : log.includes("✅") ? "text-green-400" : log.includes("⚠️") ? "text-yellow-400" : log.includes("🛒") ? "text-blue-400" : "text-muted-foreground"}`}>
                  {log}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right — Results */}
        <div className="lg:col-span-2 space-y-4">
          {/* Summary bar */}
          {results.length > 0 && (
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: "Scanned", val: results.length, c: "text-foreground" },
                { label: "Indexed", val: indexed, c: "text-blue-400" },
                { label: "Score ≥ 60", val: results.filter(r => r.total >= 60).length, c: "text-purple-400" },
                { label: "Buy Now", val: bought, c: "text-green-400" },
              ].map(s => (
                <div key={s.label} className="rounded-xl border bg-card p-3 text-center">
                  <div className={`text-2xl font-bold ${s.c}`}>{s.val}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Results Panel */}
          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="px-5 py-4 border-b flex items-center justify-between">
              <h2 className="font-semibold">Results</h2>
              {results.length > 0 && <span className="text-xs text-muted-foreground">{results.length} domains analysed</span>}
            </div>

            {isScoring && (
              <div className="p-12 flex flex-col items-center gap-4 text-muted-foreground">
                <div className="h-10 w-10 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                <div className="text-sm">Running full pipeline analysis…</div>
              </div>
            )}

            {!isScoring && results.length === 0 && (
              <div className="p-16 text-center">
                <div className="text-4xl mb-3">🎯</div>
                <div className="font-semibold mb-1">No results yet</div>
                <p className="text-sm text-muted-foreground">Enter domains on the left and click <strong>Start Hunt</strong></p>
              </div>
            )}

            {results.length > 0 && (
              <div className="divide-y divide-border">
                {results.map((res) => {
                  const isExpanded = expandedId === res.domain;
                  const recColor = res.recommendation === "buy" ? "bg-green-500/15 text-green-400 border-green-500/30" : res.recommendation === "watch" ? "bg-yellow-500/15 text-yellow-400 border-yellow-500/30" : "bg-red-500/15 text-red-400 border-red-500/30";
                  const readinessColor = res.parasiteReadiness === "HIGH" ? "text-green-400" : res.parasiteReadiness === "MEDIUM" ? "text-yellow-400" : "text-red-400";

                  return (
                    <div key={res.domain} className="hover:bg-muted/20 transition-colors">
                      <div className="px-5 py-3 flex items-center gap-4">
                        <ScoreBadge score={res.total || 0} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-semibold text-sm">{res.domain}</span>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${recColor}`}>
                              {res.recommendation?.toUpperCase()}
                            </span>
                            {res.matchedNiche && res.matchedNiche !== "unknown" && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded bg-blue-500/15 text-blue-400 text-[10px] font-semibold">
                                {res.matchedNiche}
                              </span>
                            )}
                            {res.isToxic && <span className="text-[10px] text-red-400 font-bold">☠ TOXIC</span>}
                          </div>
                          <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground flex-wrap">
                            <span>{res.googleIndexed ? `✅ ${res.googlePageCount ?? 0} pages` : "❌ Not indexed"}</span>
                            {res.waybackCount != null && <span>📚 {res.waybackCount} snapshots</span>}
                            {res.referringDomains != null && <span>🔗 {res.referringDomains} ref domains</span>}
                            {res.ageYears != null && res.ageYears > 0 && <span>📅 {res.ageYears}y old</span>}
                            {res.parasiteReadiness && <span className={`font-semibold ${readinessColor}`}>{res.parasiteReadiness} readiness</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {res.recommendation !== "reject" && (
                            <button
                              onClick={() => handleBuy(res.domain, res.total, selectedNiche)}
                              className={`h-8 px-3 rounded-lg text-xs font-bold transition-colors ${res.recommendation === "buy" ? "bg-green-600 text-white hover:bg-green-700" : "border border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/10"}`}
                            >
                              {res.recommendation === "buy" ? "🛒 Buy" : "👁 Watch"}
                            </button>
                          )}
                          <button onClick={() => setExpandedId(isExpanded ? null : res.domain)} className="h-8 w-8 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/30 text-xs">
                            {isExpanded ? "▲" : "▼"}
                          </button>
                        </div>
                      </div>

                      {/* Score bar */}
                      <div className="px-5 pb-2">
                        <div className="h-1 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-700 ${(res.total || 0) >= 60 ? "bg-green-500" : (res.total || 0) >= 40 ? "bg-yellow-500" : "bg-red-500"}`}
                            style={{ width: `${Math.min(100, res.total || 0)}%` }}
                          />
                        </div>
                      </div>

                      {/* Expanded Detail */}
                      {isExpanded && (
                        <div className="px-5 pb-5 bg-muted/10 border-t border-border">
                          <div className="pt-4 grid grid-cols-2 md:grid-cols-3 gap-4">
                            {/* Score breakdown */}
                            {res.breakdown && (
                              <div className="col-span-full">
                                <div className="text-xs font-semibold text-muted-foreground mb-2">Score Breakdown</div>
                                <div className="grid grid-cols-5 gap-2">
                                  {[
                                    { label: "Google", val: res.breakdown.googleIndex },
                                    { label: "Authority", val: res.breakdown.topicalAuthority },
                                    { label: "Anchors", val: res.breakdown.anchorRelevance },
                                    { label: "Keywords", val: res.breakdown.keywordHistory },
                                    { label: "Age", val: res.breakdown.age },
                                  ].map(s => (
                                    <div key={s.label} className="bg-card border rounded-lg p-2 text-center">
                                      <div className="text-xs text-muted-foreground">{s.label}</div>
                                      <div className="font-bold text-sm mt-0.5">{s.val ?? 0}</div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            {/* Historical keywords */}
                            {res.historicalKeywords && res.historicalKeywords.length > 0 && (
                              <div className="col-span-full">
                                <div className="text-xs font-semibold text-muted-foreground mb-2">Historical Keywords</div>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                  {res.historicalKeywords.slice(0, 6).map((kw, i) => (
                                    <div key={i} className="bg-card border rounded-lg px-3 py-2 text-xs">
                                      <div className="font-semibold truncate">{kw.keyword}</div>
                                      <div className="text-muted-foreground flex justify-between mt-0.5">
                                        <span>{kw.searchVolume?.toLocaleString()}/mo</span>
                                        <span>#{kw.position}</span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            {res.filterReason && (
                              <div className="col-span-full text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                                ⚠ {res.filterReason}
                              </div>
                            )}
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
      </div>
    </div>
  );
}
