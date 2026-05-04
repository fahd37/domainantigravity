"use client";

import { useEffect, useState } from "react";
import { NicheTable } from "@/components/niche-table";

type Niche = {
  id: string;
  displayName: string;
  slug: string;
  keywords: string[];
  targetTlds: string[];
  active: boolean;
};

export default function NichesPage() {
  const [initialNiches, setInitialNiches] = useState<Niche[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/niches")
      .then((res) => res.json())
      .then((json) => {
        if (json.error) setError(json.error);
        setInitialNiches(json.data || []);
      })
      .catch((e) => {
        console.error(e);
        setError("Failed to load niches.");
        setInitialNiches([]);
      });
  }, []);

  if (!initialNiches) {
    return (
      <div className="flex items-center justify-center p-16">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <div className="h-8 w-8 border-2 border-primary/40 border-t-primary rounded-full animate-spin" />
          <span className="text-sm">Loading niches…</span>
        </div>
      </div>
    );
  }

  const activeCount = initialNiches.filter((n) => n.active).length;

  return (
    <div className="flex flex-col gap-6 pb-10">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Niche Manager</h1>
          <p className="text-muted-foreground mt-1.5">
            Configure which niches and keywords the scanner targets. Active niches
            feed keywords into every scan run.
          </p>
          {error && (
            <p className="text-destructive mt-2 text-sm bg-destructive/10 p-2 rounded border border-destructive/20">
              {error}
            </p>
          )}
        </div>
        <div className="flex-shrink-0 text-right hidden md:block">
          <div className="text-2xl font-bold text-green-400">{activeCount} / {initialNiches.length}</div>
          <div className="text-xs text-muted-foreground">niches active</div>
        </div>
      </div>

      <NicheTable initialNiches={initialNiches} />
    </div>
  );
}
