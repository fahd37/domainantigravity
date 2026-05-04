"use client";

import { useState } from "react";
import { createNiche, updateNiche, deleteNiche } from "@/app/actions/niches";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";

const ALL_TLDS = [".com", ".io", ".ai", ".co", ".net", ".org"];

export function NicheTable({ initialNiches }: { initialNiches: { id: string; displayName: string; slug: string; keywords: string[]; targetTlds: string[]; active: boolean; }[] }) {
  const [niches, setNiches] = useState(initialNiches);
  const [newName, setNewName] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [newKeywords, setNewKeywords] = useState("");

  const handleAdd = async () => {
    if (!newName || !newSlug) return;
    const keywords = newKeywords.split(",").map((k) => k.trim()).filter(Boolean);
    await createNiche({
      displayName: newName,
      slug: newSlug,
      keywords: keywords.length ? keywords : [newName.toLowerCase()],
      targetTlds: [".com", ".io", ".ai"],
    });
    // Optimistic or refresh. We'll just refresh by letting Next.js revalidate
    window.location.reload(); 
  };

  const handleToggleActive = async (id: string, active: boolean) => {
    setNiches((prev) => prev.map((n) => (n.id === id ? { ...n, active } : n)));
    console.log("Client: calling updateNiche for", id, "setting active:", active);
    const result = await updateNiche(id, { active });
    console.log("Client: updateNiche result:", result);
    if (result?.error) {
      alert(`Failed to update niche: ${result.error}`);
    }
  };

  const handleDelete = async (id: string) => {
    setNiches((prev) => prev.filter((n) => n.id !== id));
    await deleteNiche(id);
  };

  const handleUpdateKeywords = async (id: string, val: string) => {
    const keywords = val.split(",").map((k) => k.trim()).filter(Boolean);
    await updateNiche(id, { keywords });
  };

  const handleToggleTld = async (id: string, tld: string, currentTlds: string[]) => {
    const newTlds = currentTlds.includes(tld)
      ? currentTlds.filter((t) => t !== tld)
      : [...currentTlds, tld];
    setNiches((prev) => prev.map((n) => (n.id === id ? { ...n, targetTlds: newTlds } : n)));
    await updateNiche(id, { targetTlds: newTlds });
  };

  const handleActivateAll = async () => {
    try {
      console.log("Client: calling PATCH /api/niches");
      const res = await fetch('/api/niches', { method: 'PATCH' })
      const data = await res.json()
      console.log("Client: PATCH /api/niches result:", data);
      if (data.success) {
        window.location.reload()
      } else {
        alert(`Failed to activate all niches: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error("Client: failed to call PATCH /api/niches", error);
      alert(`Failed to activate all niches: ${String(error)}`);
    }
  };

  const handleSeedAll = async () => {
    if (!confirm('This will upsert all 30 niches with full keyword sets. Continue?')) return;
    try {
      const res = await fetch('/api/niches/seed')
      const data = await res.json()
      if (data.success) {
        alert(`✅ Seeded ${data.seeded} niches successfully!`);
        window.location.reload()
      } else {
        alert(`Seed failed: ${data.error}`);
      }
    } catch (error) {
      alert(`Seed failed: ${String(error)}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Add Niche Card */}
      <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold leading-none tracking-tight">Add New Niche</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSeedAll}
              className="inline-flex h-8 items-center justify-center rounded-md bg-blue-600 text-white px-4 text-xs font-medium hover:bg-blue-700"
            >
              🌱 Seed All 30 Niches
            </button>
            <button
              onClick={handleActivateAll}
              className="inline-flex h-8 items-center justify-center rounded-md bg-secondary px-4 text-xs font-medium hover:bg-secondary/80"
            >
              ✅ Activate All
            </button>
          </div>
        </div>
        <div className="flex gap-4 items-end">
          <div className="space-y-2 flex-1">
            <Label>Display Name</Label>
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Clean Energy" />
          </div>
          <div className="space-y-2 flex-1">
            <Label>Slug</Label>
            <Input value={newSlug} onChange={(e) => setNewSlug(e.target.value)} placeholder="e.g. clean_energy" />
          </div>
          <div className="space-y-2 flex-1">
            <Label>Keywords (comma separated)</Label>
            <Input value={newKeywords} onChange={(e) => setNewKeywords(e.target.value)} placeholder="solar, wind, renewable" />
          </div>
          <button
            onClick={handleAdd}
            className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Add Niche
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="h-12 px-4 font-medium text-muted-foreground">Niche</th>
              <th className="h-12 px-4 font-medium text-muted-foreground">Keywords</th>
              <th className="h-12 px-4 font-medium text-muted-foreground">Target TLDs</th>
              <th className="h-12 px-4 font-medium text-muted-foreground">Active</th>
              <th className="h-12 px-4 font-medium text-muted-foreground text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {niches.map((niche) => (
              <tr key={niche.id} className="border-b last:border-0 hover:bg-muted/20">
                <td className="p-4 font-medium">{niche.displayName}</td>
                <td className="p-4">
                  <Input
                    defaultValue={niche.keywords.join(", ")}
                    onBlur={(e) => handleUpdateKeywords(niche.id, e.target.value)}
                    className="h-8 max-w-[200px]"
                  />
                </td>
                <td className="p-4">
                  <div className="flex flex-wrap gap-2">
                    {ALL_TLDS.map((tld) => (
                      <div key={tld} className="flex items-center space-x-1">
                        <Checkbox
                          id={`${niche.id}-${tld}`}
                          checked={niche.targetTlds.includes(tld)}
                          onCheckedChange={() => handleToggleTld(niche.id, tld, niche.targetTlds)}
                        />
                        <label
                          htmlFor={`${niche.id}-${tld}`}
                          className="text-xs font-medium leading-none cursor-pointer"
                        >
                          {tld}
                        </label>
                      </div>
                    ))}
                  </div>
                </td>
                <td className="p-4">
                  <Switch
                    checked={niche.active}
                    onCheckedChange={(val) => handleToggleActive(niche.id, val)}
                  />
                </td>
                <td className="p-4 text-right">
                  <button
                    onClick={() => handleDelete(niche.id)}
                    className="text-destructive hover:underline text-sm font-medium"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {niches.length === 0 && (
              <tr>
                <td colSpan={5} className="p-4 text-center text-muted-foreground">
                  No niches found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
