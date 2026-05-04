"use client";

import { useState, useTransition } from "react";
import { createNiche, updateNiche, deleteNiche } from "@/app/actions/niches";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Niche = {
  id: string;
  displayName: string;
  slug: string;
  keywords: string[];
  targetTlds: string[];
  active: boolean;
};

const NICHE_ICONS: Record<string, string> = {
  iptv: "📺",
  artificial_intelligence: "🤖",
  digital_marketing: "📈",
  finance: "💰",
  health_wellness: "🏥",
  saas_software: "⚙️",
  ecommerce: "🛒",
  cybersecurity: "🔐",
  education: "🎓",
  travel: "✈️",
  real_estate: "🏠",
  legal: "⚖️",
  pets_dogs: "🐕",
  pets_cats: "🐈",
  fitness_gyms: "💪",
  recipes_cooking: "👨‍🍳",
  dating_relationships: "❤️",
  web_hosting: "☁️",
  video_games: "🎮",
  crypto: "₿",
  make_money_online: "💸",
  supplements_vitamins: "💊",
  skincare_cosmetics: "✨",
  solar_energy: "☀️",
  home_improvement: "🔨",
  mental_health: "🧠",
  streaming_services: "🎬",
  developer_tools: "👨‍💻",
  gambling_casinos: "🎰",
  music_instruments: "🎸",
};

export function NicheTable({ initialNiches }: { initialNiches: Niche[] }) {
  const [niches, setNiches] = useState(initialNiches);
  const [newName, setNewName] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [newKeywords, setNewKeywords] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [activatingAll, setActivatingAll] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const activeCount = niches.filter((n) => n.active).length;
  const totalCount = niches.length;
  const totalKeywords = niches.reduce((acc, n) => acc + n.keywords.length, 0);

  const handleAdd = async () => {
    if (!newName || !newSlug) return;
    const keywords = newKeywords.split(",").map((k) => k.trim()).filter(Boolean);
    startTransition(async () => {
      await createNiche({
        displayName: newName,
        slug: newSlug,
        keywords: keywords.length ? keywords : [newName.toLowerCase()],
        targetTlds: [".com", ".io", ".net"],
      });
      window.location.reload();
    });
  };

  const handleToggleActive = async (id: string, active: boolean) => {
    setTogglingId(id);
    setNiches((prev) => prev.map((n) => (n.id === id ? { ...n, active } : n)));
    const result = await updateNiche(id, { active });
    setTogglingId(null);
    if (result?.error) {
      setNiches((prev) => prev.map((n) => (n.id === id ? { ...n, active: !active } : n)));
      alert(`Failed: ${result.error}`);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this niche?")) return;
    setNiches((prev) => prev.filter((n) => n.id !== id));
    await deleteNiche(id);
  };

  const handleUpdateKeywords = async (id: string, val: string) => {
    const keywords = val.split(",").map((k) => k.trim()).filter(Boolean);
    await updateNiche(id, { keywords });
    setNiches((prev) => prev.map((n) => (n.id === id ? { ...n, keywords } : n)));
  };

  const handleActivateAll = async () => {
    setActivatingAll(true);
    try {
      const res = await fetch("/api/niches", { method: "PATCH" });
      const data = await res.json();
      if (data.success) {
        setNiches((prev) => prev.map((n) => ({ ...n, active: true })));
      } else {
        alert(`Failed: ${data.error}`);
      }
    } finally {
      setActivatingAll(false);
    }
  };

  const handleSeedAll = async () => {
    if (!confirm("Upsert all 30 niches with full keyword sets and activate them all?")) return;
    setSeeding(true);
    try {
      const res = await fetch("/api/niches/seed");
      const data = await res.json();
      if (data.success) {
        window.location.reload();
      } else {
        alert(`Seed failed: ${data.error}`);
      }
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Dashboard Stats ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: "Total Niches",
            value: totalCount,
            sub: "configured",
            color: "text-blue-400",
            bg: "bg-blue-500/10 border-blue-500/20",
            icon: "🎯",
          },
          {
            label: "Active",
            value: activeCount,
            sub: "scanning now",
            color: "text-green-400",
            bg: "bg-green-500/10 border-green-500/20",
            icon: "✅",
          },
          {
            label: "Inactive",
            value: totalCount - activeCount,
            sub: "paused",
            color: "text-yellow-400",
            bg: "bg-yellow-500/10 border-yellow-500/20",
            icon: "⏸️",
          },
          {
            label: "Total Keywords",
            value: totalKeywords,
            sub: "across all niches",
            color: "text-purple-400",
            bg: "bg-purple-500/10 border-purple-500/20",
            icon: "🔑",
          },
        ].map((card) => (
          <div
            key={card.label}
            className={`rounded-xl border p-5 flex flex-col gap-1 ${card.bg}`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                {card.label}
              </span>
              <span className="text-lg">{card.icon}</span>
            </div>
            <div className={`text-3xl font-bold ${card.color}`}>{card.value}</div>
            <div className="text-xs text-muted-foreground">{card.sub}</div>
            {card.label === "Active" && totalCount > 0 && (
              <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full transition-all duration-500"
                  style={{ width: `${(activeCount / totalCount) * 100}%` }}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── Action Bar ── */}
      <div className="rounded-xl border bg-card shadow-sm p-5">
        <div className="flex flex-col md:flex-row gap-4 items-end">
          <div className="flex-1 grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Display Name</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Clean Energy"
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Slug</Label>
              <Input
                value={newSlug}
                onChange={(e) => setNewSlug(e.target.value)}
                placeholder="e.g. clean_energy"
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Keywords (comma separated)</Label>
              <Input
                value={newKeywords}
                onChange={(e) => setNewKeywords(e.target.value)}
                placeholder="solar, wind, renewable"
                className="h-9"
              />
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={handleAdd}
              disabled={!newName || !newSlug || isPending}
              className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              + Add Niche
            </button>
            <button
              onClick={handleActivateAll}
              disabled={activatingAll}
              className="h-9 px-4 rounded-lg border border-green-500/50 bg-green-500/10 text-green-400 text-sm font-semibold hover:bg-green-500/20 transition-colors disabled:opacity-50"
            >
              {activatingAll ? "Activating…" : "✅ Activate All"}
            </button>
            <button
              onClick={handleSeedAll}
              disabled={seeding}
              className="h-9 px-4 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {seeding ? "Seeding…" : "🌱 Seed 30 Niches"}
            </button>
          </div>
        </div>
      </div>

      {/* ── Niche Grid ── */}
      {niches.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-card p-16 text-center">
          <div className="text-4xl mb-4">🌱</div>
          <div className="text-lg font-semibold mb-2">No niches yet</div>
          <p className="text-muted-foreground text-sm mb-6">
            Click <strong>Seed 30 Niches</strong> to populate with a full niche database.
          </p>
          <button
            onClick={handleSeedAll}
            className="px-6 py-2.5 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors"
          >
            🌱 Seed All 30 Niches
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {niches.map((niche) => {
            const icon = NICHE_ICONS[niche.slug] ?? "🏷️";
            const isExpanded = expandedId === niche.id;
            const isToggling = togglingId === niche.id;

            return (
              <div
                key={niche.id}
                className={`rounded-xl border bg-card shadow-sm transition-all duration-200 overflow-hidden ${
                  niche.active
                    ? "border-green-500/30 shadow-green-500/5"
                    : "border-border opacity-75"
                }`}
              >
                {/* Card Header */}
                <div className="p-4 flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-2xl flex-shrink-0">{icon}</span>
                    <div className="min-w-0">
                      <div className="font-semibold text-sm truncate">{niche.displayName}</div>
                      <div className="text-xs text-muted-foreground font-mono">{niche.slug}</div>
                    </div>
                  </div>

                  {/* Active Toggle */}
                  <button
                    onClick={() => handleToggleActive(niche.id, !niche.active)}
                    disabled={isToggling}
                    className={`relative flex-shrink-0 w-12 h-6 rounded-full transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      isToggling ? "opacity-50" : ""
                    } ${niche.active ? "bg-green-500" : "bg-muted"}`}
                    title={niche.active ? "Click to deactivate" : "Click to activate"}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-300 ${
                        niche.active ? "translate-x-6" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>

                {/* Status Badge + Keywords Preview */}
                <div className="px-4 pb-3 flex items-center justify-between gap-2">
                  <div className="flex flex-wrap gap-1 min-w-0 flex-1">
                    {niche.keywords.slice(0, 4).map((kw) => (
                      <span
                        key={kw}
                        className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary"
                      >
                        {kw}
                      </span>
                    ))}
                    {niche.keywords.length > 4 && (
                      <span className="text-[10px] text-muted-foreground font-medium">
                        +{niche.keywords.length - 4} more
                      </span>
                    )}
                  </div>
                  <span
                    className={`flex-shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                      niche.active
                        ? "bg-green-500/15 text-green-400 border-green-500/30"
                        : "bg-muted text-muted-foreground border-border"
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${niche.active ? "bg-green-500" : "bg-muted-foreground"}`} />
                    {niche.active ? "ACTIVE" : "PAUSED"}
                  </span>
                </div>

                {/* Expand / Collapse */}
                <div className="border-t border-border">
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : niche.id)}
                    className="w-full px-4 py-2 text-xs text-muted-foreground hover:text-foreground flex items-center justify-between hover:bg-muted/30 transition-colors"
                  >
                    <span>{niche.keywords.length} keywords · {niche.targetTlds.join(", ")}</span>
                    <span>{isExpanded ? "▲ Less" : "▼ Edit"}</span>
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-4 space-y-3 bg-muted/10 border-t border-border">
                      <div className="pt-3 space-y-1.5">
                        <Label className="text-xs font-medium text-muted-foreground">Keywords (comma separated)</Label>
                        <Input
                          defaultValue={niche.keywords.join(", ")}
                          onBlur={(e) => handleUpdateKeywords(niche.id, e.target.value)}
                          className="h-8 text-xs font-mono"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-muted-foreground">Target TLDs</Label>
                        <div className="text-xs text-muted-foreground bg-muted/30 px-3 py-2 rounded-md font-mono">
                          {niche.targetTlds.join(" · ")}
                        </div>
                      </div>
                      <div className="flex justify-end pt-1">
                        <button
                          onClick={() => handleDelete(niche.id)}
                          className="text-xs text-destructive hover:text-destructive/80 font-medium hover:underline"
                        >
                          🗑 Delete niche
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
