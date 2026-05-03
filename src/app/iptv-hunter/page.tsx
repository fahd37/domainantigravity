"use client";

import { useState, useEffect } from "react";

const MARKETS = [
  { id: 'US', flag: '🇺🇸', name: 'US' },
  { id: 'UK', flag: '🇬🇧', name: 'UK' },
  { id: 'FR', flag: '🇫🇷', name: 'FR' },
  { id: 'DE', flag: '🇩🇪', name: 'DE' },
  { id: 'NL', flag: '🇳🇱', name: 'NL' },
  { id: 'SE', flag: '🇸🇪', name: 'SE' },
  { id: 'NO', flag: '🇳🇴', name: 'NO' },
  { id: 'DK', flag: '🇩🇰', name: 'DK' },
  { id: 'ALL', flag: '🌍', name: 'ALL' },
];

interface DomainData {
  domain: string;
  iptvScore: number;
  parasiteReadiness: string;
  estimatedRankDays: number;
  googlePages?: number;
  estimatedMonthlyRevenue?: number;
  previouslyIPTV?: boolean;
}

interface KeywordData {
  keyword: string;
  searchVolume?: number;
  volume?: number;
  cpc: number;
  category?: string;
}

interface MarketData {
  totalKeywords: number;
  avgCPC: number;
  topKeyword: string;
  difficulty: string;
  successRate: number;
  topKeywords: KeywordData[];
  dataSource?: string;
  lastUpdated?: string;
}

export default function IPTVHunterPage() {
  const [activeMarket, setActiveMarket] = useState('FR');
  const [activeTab, setActiveTab] = useState<'domains'|'keywords'|'patterns'>('domains');
  const [drawerDomain, setDrawerDomain] = useState<DomainData | null>(null);

  const [domains, setDomains] = useState<DomainData[]>([]);
  const [keywords] = useState<KeywordData[]>([]);
  const [scanning, setScanning] = useState(false);
  const [missingApis, setMissingApis] = useState<{dfs: boolean; namecheap: boolean}>({ dfs: false, namecheap: false });
  const [marketData, setMarketData] = useState<MarketData | null>(null);
  const [updating, setUpdating] = useState(false);

  const fetchMarketData = (market: string) => {
    if (market && market !== 'ALL') {
      fetch(`/api/iptv/markets/${market}`)
        .then(res => res.json())
        .then(json => {
          if (json.data) {
            setMarketData(json.data);
          } else {
            setMarketData(null);
          }
        })
        .catch(() => setMarketData(null));
    } else {
      setMarketData(null);
    }
  };

  useEffect(() => {
    fetchMarketData(activeMarket);
  }, [activeMarket]);

  const handleUpdateMarketData = async (market: string) => {
    setUpdating(true);
    try {
      const res = await fetch('/api/iptv/update-keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markets: [market] })
      });

      const data = await res.json();
      setUpdating(false);
      
      // Refresh market data
      fetchMarketData(market);
      
      alert(data.success ? `✅ Market data updated\n${market}: "${data.details?.[0]?.topKeyword}" — ${data.details?.[0]?.topKeywordVolume?.toLocaleString()} searches` : `❌ Update failed\n${data.error || 'Unknown error'}`);
    } catch (err) {
      setUpdating(false);
      alert(`❌ Update failed: ${err}`);
    }
  };

  const formatCurrency = (amount: number, market: string) => {
    if (market === 'US' || market === 'UK') return `$${amount.toFixed(2)}`;
    if (market === 'SE' || market === 'NO' || market === 'DK') return `${amount.toFixed(2)} kr`;
    return `€${amount.toFixed(2)}`;
  };

  const timeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + " years ago";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + " months ago";
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + " days ago";
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + " hours ago";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + " minutes ago";
    return Math.floor(seconds) + " seconds ago";
  };

  useEffect(() => {
    fetch("/api/settings")
      .then(res => res.json())
      .then(json => {
        if (json.data) {
          setMissingApis({
            dfs: !json.data.dataForSeoEmail || !json.data.dataForSeoPassword,
            namecheap: !json.data.namecheapUser || !json.data.namecheapApiKey
          });
        }
      })
      .catch(console.error);
  }, []);

  // Stats (real zeros until fetched)
  const stats = {
    markets: 8,
    keywords: keywords.length,
    domainsToday: domains.length,
    avgTimeToRank: domains.length > 0 ? Math.round(domains.reduce((acc, d) => acc + d.estimatedRankDays, 0) / domains.length) : 0
  };

  const handleScan = async () => {
    setScanning(true);
    try {
      const res = await fetch('/api/iptv/scan', { method: 'POST', body: JSON.stringify({ markets: [activeMarket] }) });
      const data = await res.json();
      if (data.results) {
        setDomains(data.results);
      }
    } finally {
      setScanning(false);
    }
  };

  // Drawer Component
  const DomainDrawer = ({ domain, onClose }: { domain: DomainData | null, onClose: () => void }) => {
    if (!domain) return null;
    return (
      <div className="fixed inset-0 z-50 flex">
        <div className="flex-1 bg-black/60" onClick={onClose} />
        <div className="w-full max-w-2xl bg-card border-l overflow-y-auto p-6 space-y-6 animate-in slide-in-from-right duration-300">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-bold flex items-center gap-2">📺 {domain.domain}</h2>
              <div className="flex gap-2 mt-2">
                <span className="bg-green-500/20 text-green-400 px-2 py-1 rounded text-xs font-bold">IPTV Score: {domain.iptvScore}/100 🔥</span>
                <span className="bg-blue-500/20 text-blue-400 px-2 py-1 rounded text-xs font-bold">Parasite Readiness: {domain.parasiteReadiness}</span>
                <span className="bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded text-xs font-bold">Est. Rank: {domain.estimatedRankDays} days</span>
              </div>
            </div>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl">✕</button>
          </div>

          <div className="rounded-lg bg-orange-500/10 border border-orange-500/20 p-4">
            <h3 className="text-orange-400 font-bold mb-1">🔥 WAS IPTV SITE BEFORE</h3>
            <p className="text-sm text-muted-foreground">Wayback shows: French IPTV provider from 2019-2022, ~50 indexed pages</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg bg-muted/40 p-4">
              <h3 className="font-semibold mb-2 text-sm">📊 IPTV Score Breakdown</h3>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li className="flex justify-between">Pattern match: <span className="text-foreground">40/40 ✅</span></li>
                <li className="flex justify-between">Previous IPTV: <span className="text-foreground">28/30 ✅</span></li>
                <li className="flex justify-between">Google trust: <span className="text-foreground">12/15 ✅</span></li>
                <li className="flex justify-between">TLD fit: <span className="text-foreground">10/10 ✅</span></li>
                <li className="flex justify-between">Age (4 years): <span className="text-foreground">3/5 ✅</span></li>
              </ul>
            </div>
            <div className="rounded-lg bg-muted/40 p-4">
              <h3 className="font-semibold mb-2 text-sm">💰 Revenue Estimate</h3>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li className="flex justify-between">Month 1: <span className="text-green-400">$180-320</span></li>
                <li className="flex justify-between">Month 3: <span className="text-green-400">$420-680</span></li>
                <li className="flex justify-between">Month 6: <span className="text-green-400">$800-1,400</span></li>
              </ul>
            </div>
          </div>

          <button onClick={onClose} className="w-full py-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-lg transition-colors">
            🛒 Buy & Deploy →
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-8 pb-12">
      {/* Header & Market Selector */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-6">📺 IPTV Domain Intelligence</h1>
        <div className="flex flex-wrap gap-2">
          {MARKETS.map(m => (
            <button
              key={m.id}
              onClick={() => setActiveMarket(m.id)}
              className={`px-4 py-3 rounded-xl border text-lg font-bold flex items-center gap-2 transition-all ${
                activeMarket === m.id 
                  ? 'bg-blue-600 text-white border-blue-600 scale-105 shadow-lg shadow-blue-900/20' 
                  : 'bg-card text-muted-foreground hover:bg-muted'
              }`}
            >
              <span className="text-2xl">{m.flag}</span>
              {m.name}
            </button>
          ))}
        </div>
      </div>

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

      {/* Live Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Markets Active", value: stats.markets, icon: "🌍" },
          { label: "IPTV Keywords Tracked", value: stats.keywords.toLocaleString(), icon: "📺" },
          { label: "Domains Found Today", value: stats.domainsToday, icon: "🏆", color: "text-green-400" },
          { label: "Avg Time to Rank", value: stats.avgTimeToRank ? `${stats.avgTimeToRank} days` : "—", icon: "⚡", color: "text-yellow-400" },
        ].map((s, i) => (
          <div key={i} className="rounded-xl border bg-card p-5">
            <div className="text-2xl mb-2">{s.icon}</div>
            <div className="text-xs text-muted-foreground mb-1">{s.label}</div>
            <div className={`text-lg font-bold ${s.color || ''}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Market Intelligence Panel */}
      {marketData && (
        <div className="rounded-xl border bg-card p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none text-9xl">
            {MARKETS.find(m => m.id === activeMarket)?.flag}
          </div>
          <div className="flex items-start justify-between mb-4">
            <h2 className="text-xl font-bold flex items-center gap-2 uppercase">
              {MARKETS.find(m => m.id === activeMarket)?.flag} {MARKETS.find(m => m.id === activeMarket)?.name} IPTV MARKET INTELLIGENCE
            </h2>
            <div className="flex flex-col items-end gap-1">
              <button 
                onClick={() => handleUpdateMarketData(activeMarket)} 
                disabled={updating}
                className="text-xs px-3 py-1.5 bg-muted hover:bg-muted/80 rounded-md font-semibold disabled:opacity-50 transition-colors"
              >
                {updating ? 'Updating...' : '🔄 Refresh Live Data'}
              </button>
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                  marketData.dataSource === 'dataforseo-live' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
                }`}>
                  {marketData.dataSource === 'dataforseo-live' ? '✅ Live DataForSEO data' : '📊 Estimated data'}
                </span>
                <span className="text-[10px] text-muted-foreground font-mono">
                  {marketData.lastUpdated ? `Updated ${timeAgo(marketData.lastUpdated)}` : 'Never updated'}
                </span>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between border-b border-border/50 pb-2">
                <span className="text-muted-foreground">Total searches/month:</span>
                <span className="font-mono font-bold">{(marketData.totalKeywords || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between border-b border-border/50 pb-2">
                <span className="text-muted-foreground">Avg CPC:</span>
                <span className="font-mono font-bold">{formatCurrency(marketData.avgCPC || 0, activeMarket)}</span>
              </div>
              <div className="flex justify-between border-b border-border/50 pb-2">
                <span className="text-muted-foreground">Top keyword:</span>
                <span className="font-mono font-bold">&quot;{marketData.topKeyword}&quot;</span>
              </div>
              <div className="flex justify-between border-b border-border/50 pb-2">
                <span className="text-muted-foreground">Competition level:</span>
                <span className="font-bold text-green-400">{marketData.difficulty} ✅</span>
              </div>
              <div className="flex justify-between border-b border-border/50 pb-2">
                <span className="text-muted-foreground">Success rate:</span>
                <span className="font-mono font-bold">{Math.round(marketData.successRate || 0)}%</span>
              </div>
            </div>

            <div>
              <h3 className="font-bold text-orange-400 mb-3 flex items-center gap-2">🔥 HOT RIGHT NOW:</h3>
              <div className="space-y-3">
                {marketData.topKeywords?.slice(0, 2).map((kw: KeywordData, i: number) => (
                  <div key={i} className="bg-muted/30 p-3 rounded-lg border border-border/50">
                    <div className="font-bold text-sm">&quot;{kw.keyword}&quot;</div>
                    <div className="text-xs text-muted-foreground mt-1">{(kw.volume || 0).toLocaleString()} searches • CPC {formatCurrency(kw.cpc || 0, activeMarket)}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          <button onClick={handleScan} disabled={scanning} className="mt-6 w-full py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold transition-colors disabled:opacity-50">
            {scanning ? "Scanning..." : `Start Hunting ${MARKETS.find(m => m.id === activeMarket)?.name} IPTV Domains →`}
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b">
        <button onClick={() => setActiveTab('domains')} className={`px-4 py-2 font-medium ${activeTab === 'domains' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground'}`}>Domain Results</button>
        <button onClick={() => setActiveTab('keywords')} className={`px-4 py-2 font-medium ${activeTab === 'keywords' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground'}`}>Keyword Intelligence</button>
        <button onClick={() => setActiveTab('patterns')} className={`px-4 py-2 font-medium ${activeTab === 'patterns' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground'}`}>Pattern Generator</button>
      </div>

      {/* Tab Content */}
      <div className="bg-card border rounded-xl overflow-hidden min-h-[400px]">
        {activeTab === 'domains' && (
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/30 border-b">
              <tr>
                <th className="px-4 py-3 font-medium text-muted-foreground">Domain</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Score</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Google Pgs</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Est $/mo</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Readiness</th>
              </tr>
            </thead>
            <tbody>
              {domains.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    {scanning ? "Scanning... This may take a few minutes." : "No domains found yet — click Scan to start"}
                  </td>
                </tr>
              ) : (
                domains.map(d => (
                  <tr key={d.domain} onClick={() => setDrawerDomain(d)} className="border-b hover:bg-muted/20 cursor-pointer">
                    <td className="px-4 py-3 font-medium flex items-center gap-2">
                      {d.domain} {d.previouslyIPTV && <span title="Was IPTV Before">🔥</span>}
                    </td>
                    <td className="px-4 py-3 font-mono text-green-400 font-bold">{d.iptvScore}</td>
                    <td className="px-4 py-3">{d.googlePages ?? 0}</td>
                    <td className="px-4 py-3 font-mono text-green-400">${d.estimatedMonthlyRevenue ?? 0}</td>
                    <td className="px-4 py-3"><span className="bg-green-500/20 text-green-400 px-2 py-1 rounded text-xs">{d.parasiteReadiness}</span></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}

        {activeTab === 'keywords' && (
          <div className="p-6">
            <p className="text-muted-foreground mb-4">Keyword Intelligence database for {activeMarket}</p>
            {/* Table placeholder */}
            <table className="w-full text-sm text-left border rounded-lg overflow-hidden">
              <thead className="bg-muted border-b">
                <tr>
                  <th className="px-4 py-2">Keyword</th>
                  <th className="px-4 py-2">Volume</th>
                  <th className="px-4 py-2">CPC</th>
                  <th className="px-4 py-2">Category</th>
                </tr>
              </thead>
              <tbody>
                {keywords.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-4 text-center text-muted-foreground">No keywords loaded.</td>
                  </tr>
                ) : (
                  keywords.map((kw, i) => (
                    <tr key={i} className="border-b">
                      <td className="px-4 py-2">{kw.keyword}</td>
                      <td className="px-4 py-2">{kw.searchVolume?.toLocaleString()}</td>
                      <td className="px-4 py-2">€{kw.cpc?.toFixed(2)}</td>
                      <td className="px-4 py-2">{kw.category}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'patterns' && (
          <div className="p-6">
            <h3 className="font-bold mb-2">Generated Domain Patterns for {activeMarket}</h3>
            <div className="bg-muted/20 p-4 rounded-lg font-mono text-sm space-y-2">
              <div>meilleur-iptv-2026.fr</div>
              <div>iptv-france-sports.fr</div>
              <div>abonnement-iptv-pro.fr</div>
            </div>
            <button className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium">Hunt These Patterns</button>
          </div>
        )}
      </div>

      <DomainDrawer domain={drawerDomain} onClose={() => setDrawerDomain(null)} />
    </div>
  );
}
