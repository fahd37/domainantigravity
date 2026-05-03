export interface CompetitorPattern {
  preferredTLDs: string[];
  avgDR: number;
  avgAge: number;
  topNiches: string[];
  avgPrice: number;
  keywordPatterns: string[];
}

export interface CompetitorPortfolio {
  domains: string[];
  patterns: CompetitorPattern;
}

export async function analyzeCompetitorPortfolio(
  competitorDomain: string,
  dfsEmail?: string,
  dfsPassword?: string
): Promise<CompetitorPortfolio> {
  const discovered = new Set<string>();

  // 1. Wayback CDX — subdomains and related URLs used by competitor
  try {
    const cdxUrl = `https://web.archive.org/cdx/search/cdx?url=*.${competitorDomain}&output=json&fl=original&collapse=urlkey&limit=500`;
    const cdxRes = await fetch(cdxUrl, { signal: AbortSignal.timeout(15000) });
    if (cdxRes.ok) {
      const text = await cdxRes.text();
      if (text.trim()) {
        const rows: string[][] = JSON.parse(text);
        for (const row of rows.slice(1)) {
          const raw = row[0] || "";
          const match = raw.match(/^https?:\/\/([a-z0-9][a-z0-9.-]+\.[a-z]{2,})/i);
          if (match?.[1]) {
            const dom = match[1].replace(/^www\./, "").toLowerCase();
            if (dom !== competitorDomain && dom.includes(".")) discovered.add(dom);
          }
        }
      }
    }
  } catch (err) {
    console.warn("[Spy] CDX fetch failed:", err);
  }

  // 2. DataForSEO backlinks — outbound links = sites they reference / own
  if (dfsEmail && dfsPassword) {
    try {
      const credentials = Buffer.from(`${dfsEmail}:${dfsPassword}`).toString("base64");
      const bRes = await fetch("https://api.dataforseo.com/v3/backlinks/domain_pages/live", {
        method: "POST",
        headers: { Authorization: `Basic ${credentials}`, "Content-Type": "application/json" },
        body: JSON.stringify([{ target: competitorDomain, limit: 100 }]),
        signal: AbortSignal.timeout(15000),
      });
      if (bRes.ok) {
        const bData = await bRes.json();
        const pages = bData.tasks?.[0]?.result || [];
        for (const page of pages) {
          const outLinks: { domain?: string }[] = page.outgoing_links_external || [];
          for (const link of outLinks) {
            const dom = (link.domain || "").replace(/^www\./, "").toLowerCase();
            if (dom && dom.includes(".") && dom !== competitorDomain) discovered.add(dom);
          }
        }
      }
    } catch (err) {
      console.warn("[Spy] DataForSEO backlinks failed:", err);
    }
  }

  const domains = Array.from(discovered).slice(0, 200);

  // 3. Build patterns from discovered domains
  const tldCounts: Record<string, number> = {};
  const keywordCounts: Record<string, number> = {};
  const totalAge = 0;
  const ageCount = 0;

  for (const d of domains) {
    const tldMatch = d.match(/(\.[a-z]{2,})$/);
    if (tldMatch) {
      tldCounts[tldMatch[1]] = (tldCounts[tldMatch[1]] || 0) + 1;
    }

    // Extract keywords from domain name
    const namePart = d.split(".")[0];
    const words = namePart.split(/[-_]/).filter(w => w.length > 2);
    for (const w of words) {
      keywordCounts[w] = (keywordCounts[w] || 0) + 1;
    }
  }

  // Sort by frequency
  const preferredTLDs = Object.entries(tldCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([tld]) => tld);

  const keywordPatterns = Object.entries(keywordCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([kw]) => kw);

  // Estimate niches from keyword patterns using simple category mapping
  const nicheMap: Record<string, string[]> = {
    tech: ["tech", "digital", "software", "app", "code", "dev", "io"],
    seo: ["seo", "rank", "search", "link", "backlink", "traffic"],
    marketing: ["market", "brand", "growth", "lead", "convert", "funnel"],
    health: ["health", "fit", "wellness", "diet", "med", "doctor"],
    finance: ["finance", "money", "invest", "capital", "fund", "wealth"],
  };

  const nicheScores: Record<string, number> = {};
  for (const kw of keywordPatterns) {
    for (const [niche, terms] of Object.entries(nicheMap)) {
      if (terms.some(t => kw.includes(t))) {
        nicheScores[niche] = (nicheScores[niche] || 0) + 1;
      }
    }
  }
  const topNiches = Object.entries(nicheScores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([n]) => n);

  const avgAge = ageCount > 0 ? totalAge / ageCount : 0;

  return {
    domains,
    patterns: {
      preferredTLDs: preferredTLDs.length ? preferredTLDs : [".com", ".net", ".io"],
      avgDR: 25,
      avgAge: avgAge,
      topNiches: topNiches.length ? topNiches : ["tech"],
      avgPrice: 12,
      keywordPatterns,
    },
  };
}
