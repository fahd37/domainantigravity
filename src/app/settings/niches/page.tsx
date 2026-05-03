"use client";

import { useEffect, useState } from "react";
import { NicheTable } from "@/components/niche-table";

export default function NichesPage() {
  const [initialNiches, setInitialNiches] = useState<{ id: string; displayName: string; slug: string; keywords: string[]; targetTlds: string[]; active: boolean; }[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/niches")
      .then((res) => res.json())
      .then((json) => {
        if (json.error) {
          setError(json.error);
        }
        setInitialNiches(json.data || []);
      })
      .catch((e) => {
        console.error(e);
        setError("Failed to load niches. Running in UI-only mode.");
        setInitialNiches([]);
      });
  }, []);

  if (!initialNiches) {
    return <div className="p-8">Loading niches...</div>;
  }

  return (
    <div className="flex flex-col gap-6 pb-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Niche Manager</h1>
        <p className="text-muted-foreground mt-2">
          Manage target niches, keywords, and specific TLDs for the domain crawler.
        </p>
        {error && (
          <p className="text-destructive mt-2 text-sm bg-destructive/10 p-2 rounded border border-destructive/20">
            {error}
          </p>
        )}
      </div>

      <NicheTable initialNiches={initialNiches} />
    </div>
  );
}
