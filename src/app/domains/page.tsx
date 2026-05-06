"use client";
import React, { useState, useEffect, useMemo, useCallback } from "react";

interface Domain { id:string; name:string; niche:string|null; tld:string; score:number|null; status:string; source:string|null; referringDomains:number|null; domainAge:number|null; googleIndexed:boolean|null; googlePageCount:number|null; createdAt:string }

export default function DomainsPage() {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [nicheFilter, setNicheFilter] = useState("");
  const [minScore, setMinScore] = useState(0);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"score"|"name"|"date">("score");

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/domains?limit=500");
      const j = await r.json();
      if (j.data) setDomains(j.data);
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const niches = useMemo(() => Array.from(new Set(domains.map(d=>d.niche).filter(Boolean) as string[])), [domains]);
  const statuses = useMemo(() => Array.from(new Set(domains.map(d=>d.status))), [domains]);

  const filtered = useMemo(() => {
    return domains.filter(d => {
      if (statusFilter && d.status !== statusFilter) return false;
      if (nicheFilter && d.niche !== nicheFilter) return false;
      if ((d.score ?? 0) < minScore) return false;
      if (search && !d.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    }).sort((a, b) => {
      if (sortBy === "score") return (b.score ?? 0) - (a.score ?? 0);
      if (sortBy === "name") return a.name.localeCompare(b.name);
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [domains, statusFilter, nicheFilter, minScore, search, sortBy]);

  const deleteDomain = async (id: string) => {
    try { await fetch(`/api/domains?id=${id}`, { method: "DELETE" }); load(); } catch {}
  };

  const stats = useMemo(() => ({
    total: domains.length,
    queued: domains.filter(d=>d.status==="QUEUED").length,
    pending: domains.filter(d=>d.status==="PENDING").length,
    rejected: domains.filter(d=>d.status==="REJECTED").length,
    bought: domains.filter(d=>d.status==="BOUGHT").length,
  }), [domains]);

  const handleExportCSV = () => {
    const rows = [["Domain","Niche","Score","Status","Indexed","Refs","Age","Found"].join(",")];
    for (const d of filtered) {
      rows.push([d.name, d.niche||"", d.score??0, d.status, d.googleIndexed?"yes":"no", d.referringDomains??0, d.domainAge??0, d.createdAt.split("T")[0]].join(","));
    }
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "domains.csv"; a.click();
  };

  return (
    <div className="flex flex-col gap-5 pb-10">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">🌐 Domains</h1>
          <p className="text-muted-foreground mt-1 text-sm">{stats.total} domains found by the pipeline</p>
        </div>
        <button onClick={handleExportCSV} disabled={filtered.length===0} className="h-9 px-4 rounded-lg border text-sm font-medium hover:bg-muted/50 disabled:opacity-40">📄 Export CSV</button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { l:"Total", v:stats.total, c:"text-foreground" },
          { l:"Queued", v:stats.queued, c:"text-green-400" },
          { l:"Pending", v:stats.pending, c:"text-yellow-400" },
          { l:"Rejected", v:stats.rejected, c:"text-red-400" },
          { l:"Bought", v:stats.bought, c:"text-blue-400" },
        ].map(s=>(
          <div key={s.l} className="rounded-xl border bg-card p-2.5 text-center">
            <div className={`text-xl font-bold ${s.c}`}>{s.v}</div>
            <div className="text-[10px] text-muted-foreground">{s.l}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="space-y-1">
          <label className="text-[10px] text-muted-foreground uppercase">Search</label>
          <input className="h-8 w-44 rounded-lg border border-input bg-transparent px-3 text-xs" placeholder="Search domains..." value={search} onChange={e=>setSearch(e.target.value)} />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] text-muted-foreground uppercase">Niche</label>
          <select className="h-8 rounded-lg border border-input bg-transparent px-2 text-xs" value={nicheFilter} onChange={e=>setNicheFilter(e.target.value)}>
            <option value="">All Niches</option>
            {niches.map(n=><option key={n} value={n}>{n.replace(/_/g," ")}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-[10px] text-muted-foreground uppercase">Status</label>
          <select className="h-8 rounded-lg border border-input bg-transparent px-2 text-xs" value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}>
            <option value="">All</option>
            {statuses.map(s=><option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-[10px] text-muted-foreground uppercase">Min Score: {minScore}</label>
          <input type="range" min={0} max={100} value={minScore} onChange={e=>setMinScore(+e.target.value)} className="w-28 h-8" />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] text-muted-foreground uppercase">Sort</label>
          <select className="h-8 rounded-lg border border-input bg-transparent px-2 text-xs" value={sortBy} onChange={e=>setSortBy(e.target.value as typeof sortBy)}>
            <option value="score">Score ↓</option>
            <option value="date">Newest</option>
            <option value="name">Name A-Z</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center p-16"><div className="h-8 w-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin"/></div>
        ) : filtered.length === 0 ? (
          <div className="p-16 text-center">
            <div className="text-4xl mb-3">🌐</div>
            <div className="font-semibold">No domains found</div>
            <p className="text-sm text-muted-foreground mt-1">Run the pipeline from Hunt or Dashboard to find domains</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="border-b text-muted-foreground bg-muted/20">
                <th className="text-left px-4 py-2.5 font-medium">Domain</th>
                <th className="text-left px-4 py-2.5 font-medium">Niche</th>
                <th className="text-center px-4 py-2.5 font-medium">Score</th>
                <th className="text-center px-4 py-2.5 font-medium">Indexed</th>
                <th className="text-center px-4 py-2.5 font-medium">Refs</th>
                <th className="text-center px-4 py-2.5 font-medium">Age</th>
                <th className="text-center px-4 py-2.5 font-medium">Status</th>
                <th className="text-center px-4 py-2.5 font-medium">Found</th>
                <th className="text-right px-4 py-2.5 font-medium">Action</th>
              </tr></thead>
              <tbody>
                {filtered.map(d=>(
                  <tr key={d.id} className="border-b last:border-0 hover:bg-muted/20">
                    <td className="px-4 py-2.5">
                      <div className="font-mono font-bold">{d.name}</div>
                      <div className="text-[10px] text-muted-foreground">{d.source||"pipeline"}</div>
                    </td>
                    <td className="px-4 py-2.5"><span className="px-2 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-semibold">{d.niche?.replace(/_/g," ")||"—"}</span></td>
                    <td className="px-4 py-2.5 text-center"><span className={`font-bold ${(d.score??0)>=60?"text-green-400":(d.score??0)>=40?"text-yellow-400":"text-red-400"}`}>{d.score??0}</span></td>
                    <td className="px-4 py-2.5 text-center">{d.googleIndexed===true?<span className="text-green-400">✅ {d.googlePageCount??""}</span>:"❌"}</td>
                    <td className="px-4 py-2.5 text-center font-mono">{d.referringDomains??0}</td>
                    <td className="px-4 py-2.5 text-center">{d.domainAge?`${d.domainAge}yr`:"—"}</td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        d.status==="QUEUED"?"bg-green-500/10 text-green-400":
                        d.status==="BOUGHT"?"bg-blue-500/10 text-blue-400":
                        d.status==="REJECTED"?"bg-red-500/10 text-red-400":
                        "bg-yellow-500/10 text-yellow-400"
                      }`}>{d.status}</span>
                    </td>
                    <td className="px-4 py-2.5 text-center text-muted-foreground">{d.createdAt?.split("T")[0]}</td>
                    <td className="px-4 py-2.5 text-right">
                      <button onClick={()=>deleteDomain(d.id)} className="h-6 px-2 rounded text-[10px] border border-red-500/30 text-red-400 hover:bg-red-500/10" title="Delete">✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
