export interface TopReferrer {
  domain: string;
  alive: boolean;
  indexed: boolean;
  rank: number;
  backlinks: number;
  isRelevant: boolean;
}

export interface LinkQualityReport {
  qualityScore: number;
  aliveRatio: number;
  indexedRatio: number;
  relevanceRatio: number;
  linkVelocityRisk: boolean;
  geoDistribution: number;
  topReferrers: TopReferrer[];
  verdict: "clean" | "suspicious" | "toxic";
}

function extractNicheKeywords(domain: string): string[] {
  const name = domain.split(".")[0].toLowerCase();
  return name.split(/[-_]/).filter(w => w.length > 2);
}

function sharesNiche(referrer: string, targetDomain: string): boolean {
  const targetKws = extractNicheKeywords(targetDomain);
  const referrerKws = extractNicheKeywords(referrer);
  return targetKws.some(kw => referrerKws.includes(kw)) ||
    referrer.split(".").pop() === targetDomain.split(".").pop();
}

async function isAlive(domain: string): Promise<boolean> {
  try {
    const res = await fetch(`https://${domain}`, {
      method: "HEAD",
      signal: AbortSignal.timeout(5000),
      redirect: "follow",
    });
    return res.status < 400;
  } catch {
    try {
      const res = await fetch(`http://${domain}`, {
        method: "HEAD",
        signal: AbortSignal.timeout(5000),
        redirect: "follow",
      });
      return res.status < 400;
    } catch {
      return false;
    }
  }
}

async function isIndexed(domain: string): Promise<boolean> {
  try {
    const res = await fetch(
      `https://www.google.com/search?q=site:${encodeURIComponent(domain)}&num=1`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Accept": "text/html",
        },
        signal: AbortSignal.timeout(8000),
      }
    );
    if (!res.ok) return false;
    const html = await res.text();
    // Look for result count indicator
    return (
      html.includes("About") && html.includes("results") ||
      html.includes("result") && !html.includes("did not match any documents") ||
      !html.includes("did not match")
    );
  } catch {
    return false;
  }
}

export async function checkLinkQuality(
  domain: string,
  dfsEmail?: string,
  dfsPassword?: string
): Promise<LinkQualityReport> {
  let rawReferrers: Array<{ domain: string; rank: number; backlinks: number; country?: string }> = [];
  let linkVelocityRisk = false;

  // Step 1 — Fetch top referring domains via DataForSEO
  if (dfsEmail && dfsPassword) {
    try {
      const credentials = Buffer.from(`${dfsEmail}:${dfsPassword}`).toString("base64");
      const res = await fetch("https://api.dataforseo.com/v3/backlinks/referring_domains/live", {
        method: "POST",
        headers: { Authorization: `Basic ${credentials}`, "Content-Type": "application/json" },
        body: JSON.stringify([{ target: domain, limit: 20, order_by: ["rank,desc"] }]),
        signal: AbortSignal.timeout(15000),
      });

      if (res.ok) {
        const data = await res.json();
        const items = data?.tasks?.[0]?.result?.[0]?.items || [];
        rawReferrers = items.map((item: {
          domain?: string;
          rank?: number;
          backlinks?: number;
          country?: string;
          first_seen?: string;
          lost_date?: string;
        }) => ({
          domain: item.domain || "",
          rank: item.rank || 0,
          backlinks: item.backlinks || 0,
          country: item.country,
        }));

        // Check link velocity risk: any referrer with first_seen recently in bulk
        const recentLinks = items.filter((item: { first_seen?: string }) => {
          if (!item.first_seen) return false;
          const firstSeen = new Date(item.first_seen);
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          return firstSeen > thirtyDaysAgo;
        });
        linkVelocityRisk = recentLinks.length >= rawReferrers.length * 0.5 && rawReferrers.length > 5;
      }
    } catch (err) {
      console.warn("[LinkQuality] DataForSEO failed:", err);
    }
  }

  // Fallback: use CDX to find referrers if DFS unavailable
  if (rawReferrers.length === 0) {
    try {
      const cdxRes = await fetch(
        `https://web.archive.org/cdx/search/cdx?url=*&output=json&fl=urlkey&collapse=urlkey&filter=original:.*${domain}.*&limit=20`,
        { signal: AbortSignal.timeout(10000) }
      );
      if (cdxRes.ok) {
        const text = await cdxRes.text().catch(() => "");
        if (text.trim()) {
          const rows: string[][] = JSON.parse(text);
          rawReferrers = rows.slice(1).map(r => ({
            domain: r[0]?.split("/")?.[0]?.replace(/^www\./, "") || "",
            rank: 0,
            backlinks: 1,
          })).filter(r => r.domain && r.domain !== domain);
        }
      }
    } catch { /* ignore */ }
  }

  const validReferrers = rawReferrers.filter(r => r.domain && r.domain.includes(".")).slice(0, 20);

  // Step 2 — Parallel checks on each referrer
  const BATCH = 5;
  const checked: TopReferrer[] = [];

  for (let i = 0; i < validReferrers.length; i += BATCH) {
    const batch = validReferrers.slice(i, i + BATCH);
    const results = await Promise.all(
      batch.map(async (ref) => {
        const [alive, indexed] = await Promise.all([
          isAlive(ref.domain),
          isIndexed(ref.domain),
        ]);
        return {
          domain: ref.domain,
          alive,
          indexed,
          rank: ref.rank,
          backlinks: ref.backlinks,
          isRelevant: sharesNiche(ref.domain, domain),
        };
      })
    );
    checked.push(...results);
  }

  const total = checked.length || 1;
  const aliveCount = checked.filter(r => r.alive).length;
  const indexedCount = checked.filter(r => r.indexed).length;
  const relevantCount = checked.filter(r => r.isRelevant).length;

  // Step 3 — Geo distribution (unique countries from DFS data)
  const countries = new Set(rawReferrers.map(r => r.country).filter(Boolean));
  const geoDistribution = countries.size || Math.min(checked.length, 3);

  const aliveRatio = aliveCount / total;
  const indexedRatio = indexedCount / total;
  const relevanceRatio = relevantCount / total;

  // Step 4 — Score
  let qualityScore = (aliveRatio * 30) + (indexedRatio * 40) + (relevanceRatio * 20) + (geoDistribution > 5 ? 10 : 0);
  if (linkVelocityRisk) qualityScore -= 25;
  qualityScore = Math.max(0, Math.min(100, qualityScore));

  let verdict: "clean" | "suspicious" | "toxic" = "clean";
  if (qualityScore < 30 || (linkVelocityRisk && aliveRatio < 0.5)) verdict = "toxic";
  else if (qualityScore < 55) verdict = "suspicious";

  return {
    qualityScore: Math.round(qualityScore),
    aliveRatio: parseFloat(aliveRatio.toFixed(2)),
    indexedRatio: parseFloat(indexedRatio.toFixed(2)),
    relevanceRatio: parseFloat(relevanceRatio.toFixed(2)),
    linkVelocityRisk,
    geoDistribution,
    topReferrers: checked.slice(0, 10),
    verdict,
  };
}
