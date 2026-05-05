"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import { Slider } from "@/components/ui/slider";
import { DomainDrawer } from "@/components/domain-drawer";

interface Domain {
  id: string; name: string; niche: string; tld: string; score?: number; status: string;
  dr?: number; da?: number; backlinks?: number; referringDomains?: number;
  waybackPages?: number; price?: number; boughtAt?: string; filterReason?: string;
  googleIndexed?: boolean; createdAt: string; scoreBreakdown?: Record<string, number>;
}

const STATUS_CFG: Record<string,{cls:string;icon:string}> = {
  BOUGHT:{cls:"bg-green-500/20 text-green-400 border-green-500/30",icon:"✅"},
  QUEUED:{cls:"bg-blue-500/20 text-blue-400 border-blue-500/30",icon:"⏳"},
  PENDING:{cls:"bg-muted text-muted-foreground border-border",icon:"⏸"},
  SCORING:{cls:"bg-purple-500/20 text-purple-400 border-purple-500/30",icon:"📊"},
  REJECTED:{cls:"bg-red-500/20 text-red-400 border-red-500/30",icon:"❌"},
};

function Ring({ score, size=36 }: { score:number; size?:number }) {
  const c = score>=55?"#22c55e":score>=35?"#eab308":"#ef4444";
  const r=13,circ=2*Math.PI*r,dash=(score/100)*circ;
  return <svg width={size} height={size} viewBox="0 0 34 34" className="flex-shrink-0"><circle cx="17" cy="17" r={r} fill="none" stroke="currentColor" strokeWidth="2.5" className="text-muted/40"/><circle cx="17" cy="17" r={r} fill="none" stroke={c} strokeWidth="2.5" strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" transform="rotate(-90 17 17)"/><text x="17" y="17" textAnchor="middle" dominantBaseline="central" fill={c} fontSize="8" fontWeight="bold">{score}</text></svg>;
}

export default function DomainsPage() {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [nicheFilter, setNicheFilter] = useState("");
  const [scoreRange, setScoreRange] = useState([0]);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"score"|"name"|"date"|"dr"|"wayback">("score");
  const sortDir = "desc" as const;
  const [selectedDomain, setSelectedDomain] = useState<Domain|null>(null);
  const [tab, setTab] = useState<"all"|"bought"|"high"|"rejected">("all");
  const [bulkIds, setBulkIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState<Record<string,boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try { const j = await fetch("/api/domains").then(r=>r.json()); if(j.data) setDomains(j.data); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleBuy = async (d: Domain) => {
    const r = await fetch("/api/purchase/buy",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({domain:d.name,score:d.score,niche:d.niche})}).then(r=>r.json());
    if(!r.error) { alert(`✅ ${d.name} queued for purchase!`); load(); setSelectedDomain(null); } else alert(`❌ ${r.error}`);
  };
  const handleReject = async (d: Domain) => {
    await fetch("/api/domains",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:d.id,status:"REJECTED"})});
    load(); setSelectedDomain(null);
  };
  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if(!confirm("Delete this domain permanently?")) return;
    setDeleting(p=>({...p,[id]:true}));
    await fetch(`/api/domains?id=${id}`,{method:"DELETE"});
    setDeleting(p=>({...p,[id]:false}));
    load();
  };
  const handleBulkDelete = async () => {
    if(!confirm(`Delete ${bulkIds.size} domains permanently?`)) return;
    for(const id of Array.from(bulkIds)) await fetch(`/api/domains?id=${id}`,{method:"DELETE"});
    setBulkIds(new Set()); load();
  };

  const tabFilter = (d: Domain) => {
    if(tab==="bought") return d.status==="BOUGHT";
    if(tab==="high") return (d.score??0)>=55;
    if(tab==="rejected") return d.status==="REJECTED";
    return true;
  };

  const filtered = useMemo(() => {
    return domains.filter(d => {
      if(!tabFilter(d)) return false;
      if(statusFilter && d.status!==statusFilter) return false;
      if(nicheFilter && d.niche!==nicheFilter) return false;
      if((d.score??0)<scoreRange[0]) return false;
      if(search && !d.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    }).sort((a,b) => {
      let av: number, bv: number;
      if(sortBy==="score") { av=a.score??0; bv=b.score??0; }
      else if(sortBy==="dr") { av=a.dr??0; bv=b.dr??0; }
      else if(sortBy==="wayback") { av=a.waybackPages??0; bv=b.waybackPages??0; }
      else if(sortBy==="name") { return b.name.localeCompare(a.name); }
      else { av=new Date(a.createdAt).getTime(); bv=new Date(b.createdAt).getTime(); }
      return bv-av;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domains, statusFilter, nicheFilter, scoreRange, search, sortBy, sortDir, tab]);

  const niches = useMemo(() => Array.from(new Set(domains.map(d=>d.niche).filter(Boolean))), [domains]);
  const statuses = useMemo(() => Array.from(new Set(domains.map(d=>d.status))), [domains]);

  // Stats
  const total = domains.length;
  const bought = domains.filter(d=>d.status==="BOUGHT").length;
  const highValue = domains.filter(d=>(d.score??0)>=55).length;
  const avgScore = total? Math.round(domains.reduce((s,d)=>s+(d.score??0),0)/total) : 0;
  const topNiche = niches.length ? niches.reduce((best,n) => {
    const count = domains.filter(d=>d.niche===n).length;
    return count > (best.count??0) ? {niche:n,count} : best;
  }, {niche:"",count:0}).niche : "—";

  // Sort toggle handled by select dropdown

  const handleExportCSV = () => {
    const rows = [["Domain","Niche","Score","Status","DR","Backlinks","Wayback"].join(",")];
    filtered.forEach(d => rows.push([d.name,d.niche,d.score??0,d.status,d.dr??0,d.backlinks??0,d.waybackPages??0].join(",")));
    const blob = new Blob([rows.join("\n")], {type:"text/csv"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href=url; a.download="domains_export.csv"; a.click();
  };

  const toggleBulk = (id: string) => {
    const next = new Set(bulkIds);
    if(next.has(id)) next.delete(id); else next.add(id);
    setBulkIds(next);
  };

  return (
    <div className="flex flex-col gap-5 pb-10">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">📁 Domain Portfolio</h1>
          <p className="text-muted-foreground mt-1.5 text-sm">Manage, score, and acquire discovered domains across all niches.</p>
        </div>
        <div className="flex gap-2">
          {bulkIds.size>0 && <button onClick={handleBulkDelete} className="h-9 px-4 rounded-lg bg-red-600 text-white text-xs font-bold hover:bg-red-700">🗑 Delete {bulkIds.size} Selected</button>}
          <button onClick={handleExportCSV} className="h-9 px-4 rounded-lg border border-border text-xs font-medium hover:bg-muted/50">📥 Export CSV</button>
          <button onClick={load} disabled={loading} className="h-9 px-4 rounded-lg border border-border text-xs font-medium hover:bg-muted/50 disabled:opacity-50">{loading?"Loading…":"🔄 Refresh"}</button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          {label:"Total Domains",val:total,icon:"📁",c:"text-blue-400",bg:"bg-blue-500/10 border-blue-500/20"},
          {label:"Bought",val:bought,icon:"✅",c:"text-green-400",bg:"bg-green-500/10 border-green-500/20"},
          {label:"High-Value (≥55)",val:highValue,icon:"🔥",c:"text-orange-400",bg:"bg-orange-500/10 border-orange-500/20"},
          {label:"Avg Score",val:`${avgScore}/100`,icon:"📊",c:"text-purple-400",bg:"bg-purple-500/10 border-purple-500/20"},
          {label:"Top Niche",val:topNiche.replace(/_/g," "),icon:"🏷",c:"text-foreground",bg:"bg-muted border-border"},
        ].map(s=>(
          <div key={s.label} className={`rounded-xl border p-4 ${s.bg}`}>
            <div className="flex justify-between items-start mb-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{s.label}</span>
              <span>{s.icon}</span>
            </div>
            <div className={`text-xl font-bold ${s.c}`}>{s.val}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {[
          {k:"all",l:`📁 All (${total})`},
          {k:"high",l:`🔥 High-Value (${highValue})`},
          {k:"bought",l:`✅ Bought (${bought})`},
          {k:"rejected",l:`❌ Rejected (${domains.filter(d=>d.status==="REJECTED").length})`},
        ].map(t=>(
          <button key={t.k} onClick={()=>setTab(t.k as typeof tab)} className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab===t.k?"border-primary text-foreground":"border-transparent text-muted-foreground hover:text-foreground"}`}>{t.l}</button>
        ))}
      </div>

      {/* Filters */}
      <div className="rounded-xl border bg-card p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Search Domain</label>
            <input className="w-full h-9 rounded-lg border border-input bg-transparent px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" placeholder="search…" value={search} onChange={e=>setSearch(e.target.value)}/>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Status</label>
            <select className="w-full h-9 rounded-lg border border-input bg-transparent px-3 text-sm" value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}>
              <option value="">All Statuses</option>
              {statuses.map(s=><option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Niche</label>
            <select className="w-full h-9 rounded-lg border border-input bg-transparent px-3 text-sm" value={nicheFilter} onChange={e=>setNicheFilter(e.target.value)}>
              <option value="">All Niches</option>
              {niches.map(n=><option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between">
              <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Min Score</label>
              <span className="text-[10px] font-bold text-primary">{scoreRange[0]}</span>
            </div>
            <Slider min={0} max={100} step={1} value={scoreRange} onValueChange={v=>setScoreRange(v as number[])}/>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="px-5 py-3.5 border-b flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="font-semibold text-sm">Domain Portfolio</h2>
            <span className="text-xs text-muted-foreground">{filtered.length} of {total} domains</span>
          </div>
          <select className="h-8 rounded-lg border border-input bg-transparent px-2 text-xs" value={sortBy} onChange={e=>setSortBy(e.target.value as typeof sortBy)}>
            <option value="score">Sort: Score</option>
            <option value="name">Sort: Name</option>
            <option value="date">Sort: Date</option>
            <option value="dr">Sort: DR</option>
            <option value="wayback">Sort: Wayback</option>
          </select>
        </div>

        {loading && domains.length===0 && (
          <div className="flex flex-col items-center gap-4 p-16 text-muted-foreground">
            <div className="h-10 w-10 border-2 border-primary/30 border-t-primary rounded-full animate-spin"/>
            <div className="text-sm">Loading portfolio…</div>
          </div>
        )}

        {!loading && filtered.length===0 && (
          <div className="p-16 text-center">
            <div className="text-4xl mb-3">📁</div>
            <div className="font-semibold mb-1">No domains match your filters</div>
            <p className="text-sm text-muted-foreground">Try adjusting filters or run a <a href="/hunt" className="text-primary underline font-semibold">Hunt scan</a> to discover domains.</p>
          </div>
        )}

        {filtered.length>0 && (
          <div className="divide-y divide-border">
            {filtered.map(d => {
              const sc = d.score??0;
              const cfg = STATUS_CFG[d.status] ?? STATUS_CFG.PENDING;
              const isSelected = bulkIds.has(d.id);
              return (
                <div key={d.id} className={`px-5 py-3.5 flex items-center gap-4 hover:bg-muted/20 transition-colors cursor-pointer ${isSelected?"bg-primary/5":""}`} onClick={()=>setSelectedDomain(d)}>
                  <input type="checkbox" checked={isSelected} onChange={e=>{e.stopPropagation();toggleBulk(d.id);}} onClick={e=>e.stopPropagation()} className="h-4 w-4 rounded border-border accent-primary flex-shrink-0"/>
                  <Ring score={sc}/>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-sm">{d.name}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${cfg.cls}`}>{cfg.icon} {d.status}</span>
                      {d.niche && d.niche!=="unknown" && <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-primary/10 text-primary">{d.niche.replace(/_/g," ")}</span>}
                      {d.googleIndexed && <span className="text-[10px] text-green-400">🌐 Indexed</span>}
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-[11px] text-muted-foreground flex-wrap">
                      <span>DR: <strong className="text-foreground">{d.dr??0}</strong></span>
                      <span>Refs: <strong className="text-foreground">{d.referringDomains??0}</strong></span>
                      <span>Wayback: <strong className="text-foreground">{d.waybackPages??0}</strong></span>
                      <span>Added: {new Date(d.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0" onClick={e=>e.stopPropagation()}>
                    {d.status!=="BOUGHT" && d.status!=="REJECTED" && sc>=40 && (
                      <button onClick={()=>handleBuy(d)} className="h-7 px-3 rounded-lg bg-green-600/20 text-green-400 text-[10px] font-bold hover:bg-green-600/30 border border-green-600/30">🛒 Buy</button>
                    )}
                    <button onClick={()=>setSelectedDomain(d)} className="h-7 px-3 rounded-lg border border-border text-[10px] font-medium hover:bg-muted/50">Details</button>
                    <button onClick={e=>handleDelete(e,d.id)} disabled={deleting[d.id]} className="h-7 px-2 rounded-lg text-red-400 hover:bg-red-500/10 text-[10px] disabled:opacity-50">🗑</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <DomainDrawer domain={selectedDomain} open={!!selectedDomain} onOpenChange={(open: boolean)=>!open&&setSelectedDomain(null)} onBuy={handleBuy} onReject={handleReject}/>
    </div>
  );
}
