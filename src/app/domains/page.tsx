"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { DomainDrawer } from "@/components/domain-drawer";

interface Domain {
  id: string;
  name: string;
  niche: string;
  tld: string;
  score?: number;
  status: string;
  dr?: number;
  da?: number;
  backlinks?: number;
  referringDomains?: number;
  waybackPages?: number;
  price?: number;
  boughtAt?: string;
  filterReason?: string;
  createdAt: string;
  scoreBreakdown?: Record<string, number>;
}

export default function DomainsPage() {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState("");
  const [nicheFilter, setNicheFilter] = useState("");
  const [scoreRange, setScoreRange] = useState([0]);
  
  // Drawer state
  const [selectedDomain, setSelectedDomain] = useState<Domain | null>(null);

  useEffect(() => {
    fetchDomains();
  }, []);

  const fetchDomains = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/domains");
      const json = await res.json();
      if (json.data) setDomains(json.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleBuy = async (domain: Domain) => {
    try {
      const res = await fetch("/api/purchase/buy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: domain.name, score: domain.score, niche: domain.niche })
      });
      const data = await res.json();
      if (!data.error) {
        alert(`${domain.name} queued for purchase!`);
        fetchDomains();
        setSelectedDomain(null);
      } else {
        alert(`Failed: ${data.error}`);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleReject = async (domain: Domain) => {
    try {
      const res = await fetch("/api/domains", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: domain.id, status: "REJECTED" })
      });
      const data = await res.json();
      if (!data.error) {
        fetchDomains();
        setSelectedDomain(null);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm("Delete this domain permanently?")) return;
    try {
      await fetch(`/api/domains?id=${id}`, { method: "DELETE" });
      fetchDomains();
    } catch (err) {
      console.error(err);
    }
  };

  const filteredDomains = useMemo(() => {
    return domains.filter(d => {
      if (statusFilter && d.status !== statusFilter) return false;
      if (nicheFilter && d.niche !== nicheFilter) return false;
      if ((d.score || 0) < scoreRange[0]) return false;
      return true;
    });
  }, [domains, statusFilter, nicheFilter, scoreRange]);

  const uniqueNiches = useMemo(() => Array.from(new Set(domains.map(d => d.niche))), [domains]);
  const uniqueStatuses = useMemo(() => Array.from(new Set(domains.map(d => d.status))), [domains]);

  const handleExportCSV = () => {
    const headers = ["Domain", "Niche", "Score", "Status", "DR", "Backlinks", "Wayback"];
    const rows = filteredDomains.map(d => [
      d.name,
      d.niche,
      d.score || 0,
      d.status,
      d.dr || 0,
      d.backlinks || 0,
      d.waybackPages || 0
    ]);
    
    const csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(",") + "\n" 
      + rows.map(e => e.join(",")).join("\n");
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "domains_export.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getScoreColor = (score: number) => {
    if (score >= 55) return "bg-green-500";
    if (score >= 35) return "bg-yellow-500";
    return "bg-red-500";
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "BOUGHT": return "bg-green-500/20 text-green-500";
      case "QUEUED": return "bg-blue-500/20 text-blue-500";
      case "REJECTED": return "bg-red-500/20 text-red-500";
      case "SCORING": return "bg-purple-500/20 text-purple-500";
      default: return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div className="flex flex-col gap-6 pb-10">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Portfolio</h1>
          <p className="text-muted-foreground mt-2">
            Manage your analyzed and acquired domains.
          </p>
        </div>
        <Button variant="outline" onClick={handleExportCSV}>Export CSV</Button>
      </div>

      <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-4 flex flex-col md:flex-row gap-4 items-center">
        <div className="flex-1 space-y-1 w-full">
          <label className="text-xs font-semibold text-muted-foreground">Filter by Status</label>
          <select 
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
          >
            <option value="">All Statuses</option>
            {uniqueStatuses.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="flex-1 space-y-1 w-full">
          <label className="text-xs font-semibold text-muted-foreground">Filter by Niche</label>
          <select 
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
            value={nicheFilter}
            onChange={e => setNicheFilter(e.target.value)}
          >
            <option value="">All Niches</option>
            {uniqueNiches.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div className="flex-1 space-y-1 w-full min-w-[200px]">
          <div className="flex justify-between text-xs font-semibold text-muted-foreground">
            <label>Min Score ({scoreRange[0]})</label>
          </div>
          <div className="pt-2">
            <Slider 
              min={0} max={100} step={1}
              value={scoreRange}
              onValueChange={(val) => setScoreRange(val as number[])}
            />
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-muted-foreground animate-pulse">Loading domains...</div>
        ) : domains.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground border-dashed border-2 rounded-lg m-4">
            No domains yet — start a hunt to find domains.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b">
                <tr>
                  <th className="px-4 py-3 font-medium">Domain</th>
                  <th className="px-4 py-3 font-medium">Niche</th>
                  <th className="px-4 py-3 font-medium">Score</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">DR</th>
                  <th className="px-4 py-3 font-medium">Ref. Domains</th>
                  <th className="px-4 py-3 font-medium">Wayback</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredDomains.map((d) => (
                  <tr 
                    key={d.id} 
                    className="border-b last:border-0 hover:bg-muted/30 cursor-pointer"
                    onClick={() => setSelectedDomain(d)}
                  >
                    <td className="px-4 py-3 font-bold text-blue-500">{d.name}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 bg-muted rounded text-xs">{d.niche}</span>
                    </td>
                    <td className="px-4 py-3 min-w-[120px]">
                      <div className="flex items-center gap-2">
                        <span className="font-bold w-6">{d.score || 0}</span>
                        <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                          <div 
                            className={`h-full ${getScoreColor(d.score || 0)}`} 
                            style={{width: `${Math.min(100, d.score || 0)}%`}} 
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${getStatusColor(d.status)}`}>
                        {d.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">{d.dr || 0}</td>
                    <td className="px-4 py-3">{d.referringDomains || 0}</td>
                    <td className="px-4 py-3">{d.waybackPages || 0}</td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setSelectedDomain(d); }}>View</Button>
                      <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-600 hover:bg-red-50" onClick={(e) => handleDelete(e, d.id)}>Delete</Button>
                    </td>
                  </tr>
                ))}
                {filteredDomains.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-muted-foreground">
                      No domains match your filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <DomainDrawer 
        domain={selectedDomain} 
        open={!!selectedDomain} 
        onOpenChange={(open: boolean) => !open && setSelectedDomain(null)}
        onBuy={handleBuy}
        onReject={handleReject}
      />
    </div>
  );
}
