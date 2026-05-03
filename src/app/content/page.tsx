"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";

interface PipelineLog {
  step: string;
  status: "ok" | "error" | "skipped";
  message: string;
  timestamp: string;
}

interface Article {
  id: string;
  title: string;
  slug: string;
  wordCount: number;
  publishedAt: string | null;
  createdAt: string;
}

interface DomainWithPipeline {
  id: string;
  name: string;
  niche: string;
  status: string;
  pipelineStatus: string | null;
  pipelineLog: PipelineLog[] | null;
  deployedUrl: string | null;
  cloudflareZoneId: string | null;
  articles: Article[];
  createdAt: string;
}

const PIPELINE_STEPS = [
  { key: "restore", label: "Restore" },
  { key: "generate", label: "Generate" },
  { key: "cloudflare", label: "Deploy CF" },
  { key: "deploy", label: "Pages" },
  { key: "sitemap", label: "Sitemap" },
  { key: "gsc", label: "GSC" },
  { key: "email", label: "Alert" },
];

function StepDot({ step, logs }: { step: { key: string; label: string }; logs: PipelineLog[] | null }) {
  const match = logs?.find(l => l.step === step.key);
  const color = !match
    ? "bg-muted border-muted-foreground/30"
    : match.status === "ok" ? "bg-green-500 border-green-600"
    : match.status === "error" ? "bg-red-500 border-red-600"
    : "bg-muted border-muted-foreground/30";
  const icon = !match ? "·" : match.status === "ok" ? "✓" : match.status === "error" ? "✗" : "–";

  return (
    <div className="flex flex-col items-center gap-0.5" title={match?.message}>
      <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center text-[9px] font-bold text-white ${color}`}>
        {icon}
      </div>
      <span className="text-[9px] text-muted-foreground">{step.label}</span>
    </div>
  );
}

export default function ContentPage() {
  const [domains, setDomains] = useState<DomainWithPipeline[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [running, setRunning] = useState<Record<string, boolean>>({});

  const fetchDomains = useCallback(async () => {
    try {
      const res = await fetch("/api/content/domains");
      const data = await res.json();
      if (data.domains) setDomains(data.domains);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDomains();
    const id = setInterval(fetchDomains, 15000);
    return () => clearInterval(id);
  }, [fetchDomains]);

  const runPipeline = async (domain: DomainWithPipeline) => {
    setRunning(r => ({ ...r, [domain.id]: true }));
    try {
      await fetch("/api/content/pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domainId: domain.id }),
      });
      await fetchDomains();
    } finally {
      setRunning(r => ({ ...r, [domain.id]: false }));
    }
  };

  const regenerate = async (domain: DomainWithPipeline) => {
    setRunning(r => ({ ...r, [`regen-${domain.id}`]: true }));
    try {
      await fetch("/api/content/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domainId: domain.id, niche: domain.niche }),
      });
      await fetchDomains();
    } finally {
      setRunning(r => ({ ...r, [`regen-${domain.id}`]: false }));
    }
  };

  const boughtDomains = domains.filter(d => d.status === "BOUGHT");

  return (
    <div className="flex flex-col gap-6 pb-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Content Pipeline</h1>
        <p className="text-muted-foreground mt-2">
          Post-buy automation: Wayback restore → AI content → Cloudflare deploy → GSC submit.
        </p>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Bought Domains", value: boughtDomains.length },
          { label: "Pipelines Complete", value: boughtDomains.filter(d => d.pipelineStatus === "completed").length },
          { label: "Articles Generated", value: domains.reduce((s, d) => s + d.articles.length, 0) },
        ].map(stat => (
          <div key={stat.label} className="rounded-xl border bg-card p-4 shadow-sm text-center">
            <div className="text-2xl font-bold">{stat.value}</div>
            <div className="text-xs text-muted-foreground mt-1">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Domains table */}
      <div className="rounded-xl border bg-card shadow-sm">
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="font-semibold">Bought Domains</h2>
          <span className="text-xs text-muted-foreground">{boughtDomains.length} domains</span>
        </div>

        {loading && (
          <div className="p-12 text-center text-muted-foreground text-sm animate-pulse">Loading content pipeline...</div>
        )}

        {!loading && boughtDomains.length === 0 && (
          <div className="p-12 text-center text-muted-foreground">
            <p className="text-sm font-medium">No bought domains yet</p>
            <p className="text-xs mt-1">Domains purchased via Hunt or Auto-Buy will appear here.</p>
          </div>
        )}

        {boughtDomains.map(domain => {
          const ps = domain.pipelineStatus;
          const psColor = ps === "completed" ? "text-green-500" : ps === "running" ? "text-blue-500 animate-pulse" : ps === "failed" ? "text-red-500" : "text-muted-foreground";
          const isExpanded = expanded[domain.id];

          return (
            <div key={domain.id} className="border-b last:border-0">
              <div className="px-4 py-4 flex flex-col gap-3">
                {/* Domain header row */}
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{domain.name}</span>
                      <span className="px-1.5 py-0.5 text-xs bg-primary/20 text-primary rounded font-medium">{domain.niche}</span>
                      <span className={`text-xs font-medium ${psColor}`}>
                        {ps ? ps.toUpperCase() : "NO PIPELINE"}
                      </span>
                    </div>
                    {domain.deployedUrl && (
                      <a href={domain.deployedUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-500 hover:underline mt-0.5 block">
                        {domain.deployedUrl} →
                      </a>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span>{domain.articles.length} articles</span>
                    <span>·</span>
                    <span className="flex items-center gap-1">
                      Sitemap {domain.pipelineLog?.find(l => l.step === "gsc")?.status === "ok" ? "✅" : "❌"}
                    </span>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      size="sm" variant="outline"
                      onClick={() => regenerate(domain)}
                      disabled={running[`regen-${domain.id}`]}
                    >
                      {running[`regen-${domain.id}`] ? "Generating..." : "🔄 Regenerate"}
                    </Button>
                    <Button
                      size="sm"
                      variant={ps === "failed" || !ps ? "default" : "outline"}
                      onClick={() => runPipeline(domain)}
                      disabled={running[domain.id] || ps === "running"}
                    >
                      {running[domain.id] ? "Running..." : ps === "completed" ? "↺ Rerun" : "▶ Run Pipeline"}
                    </Button>
                    <Button
                      size="sm" variant="ghost"
                      onClick={() => setExpanded(e => ({ ...e, [domain.id]: !e[domain.id] }))}
                    >
                      {isExpanded ? "▲ Hide" : "▼ Articles"}
                    </Button>
                  </div>
                </div>

                {/* Pipeline step dots */}
                <div className="flex items-center gap-2">
                  <div className={`h-4 w-4 rounded-full flex-shrink-0 ${domain.status === "BOUGHT" ? "bg-green-500" : "bg-muted"} flex items-center justify-center`}>
                    <span className="text-[9px] text-white font-bold">✓</span>
                  </div>
                  <span className="text-[9px] text-muted-foreground mr-2">Buy</span>
                  <div className="h-px flex-1 bg-border" />
                  <div className="flex items-end gap-3">
                    {PIPELINE_STEPS.map(step => (
                      <StepDot key={step.key} step={step} logs={domain.pipelineLog} />
                    ))}
                  </div>
                </div>
              </div>

              {/* Articles expander */}
              {isExpanded && (
                <div className="px-4 pb-4">
                  <div className="rounded-lg border overflow-hidden">
                    <div className="bg-muted/40 px-3 py-2 text-xs font-semibold text-muted-foreground uppercase">
                      Articles ({domain.articles.length})
                    </div>
                    {domain.articles.length === 0 ? (
                      <div className="px-3 py-4 text-xs text-muted-foreground">No articles generated yet. Run the pipeline to generate content.</div>
                    ) : (
                      <table className="w-full text-xs">
                        <thead className="border-b bg-muted/20">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium">Title</th>
                            <th className="px-3 py-2 text-right font-medium">Words</th>
                            <th className="px-3 py-2 text-right font-medium">Slug</th>
                          </tr>
                        </thead>
                        <tbody>
                          {domain.articles.map(a => (
                            <tr key={a.id} className="border-b last:border-0 hover:bg-muted/20">
                              <td className="px-3 py-2">{a.title}</td>
                              <td className="px-3 py-2 text-right text-muted-foreground font-mono">{a.wordCount}</td>
                              <td className="px-3 py-2 text-right font-mono text-muted-foreground">/{a.slug}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
