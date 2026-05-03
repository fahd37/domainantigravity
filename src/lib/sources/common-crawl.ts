export interface CrawlResult {
  domain: string;
  url: string;
  timestamp: string;
  status: string;
}

const CC_BASE = "https://index.commoncrawl.org";
// Use latest crawl index
const CC_INDEX = "CC-MAIN-2025-18-index";

async function fetchCrawlIndex(keyword: string, limit = 10000): Promise<string[]> {
  const domains = new Set<string>();

  try {
    const url = `${CC_BASE}/${CC_INDEX}?url=*.${encodeURIComponent(keyword)}*&output=json&limit=${limit}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "DomainHunter/1.0" },
      signal: AbortSignal.timeout(20000),
    });

    if (!res.ok) return [];

    const text = await res.text();
    // CommonCrawl returns newline-delimited JSON (NDJSON)
    const lines = text.split("\n").filter(l => l.trim());

    for (const line of lines) {
      try {
        const record = JSON.parse(line);
        const rawUrl: string = record.url || record.filename || "";
        // Extract domain from URL
        const match = rawUrl.match(/^https?:\/\/([^/]+)/);
        if (!match?.[1]) continue;
        const domain = match[1].replace(/^www\./, "").toLowerCase();
        if (domain.includes(".") && domain.length < 100) {
          domains.add(domain);
        }
      } catch { /* skip malformed lines */ }
    }
  } catch (err) {
    console.warn(`[CommonCrawl] Fetch failed for keyword "${keyword}":`, err);
  }

  return Array.from(domains);
}

/**
 * Search CommonCrawl index for domains containing niche keywords.
 * Processes in batches of 5 keywords with 1s delay to be polite.
 */
export async function searchCommonCrawl(keywords: string[]): Promise<string[]> {
  const allDomains = new Set<string>();
  const BATCH = 5;

  for (let i = 0; i < keywords.length; i += BATCH) {
    const batch = keywords.slice(i, i + BATCH);

    const results = await Promise.allSettled(
      batch.map(kw => fetchCrawlIndex(kw))
    );

    for (const r of results) {
      if (r.status === "fulfilled") {
        for (const d of r.value) allDomains.add(d);
      }
    }

    // 1s delay between batches
    if (i + BATCH < keywords.length) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  return Array.from(allDomains);
}

/**
 * Get available CommonCrawl index names (to always use the latest).
 */
export async function getLatestCrawlIndex(): Promise<string> {
  try {
    const res = await fetch("https://index.commoncrawl.org/collinfo.json", {
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return CC_INDEX;
    const data: Array<{ id: string }> = await res.json();
    return data[0]?.id ? `${data[0].id}-index` : CC_INDEX;
  } catch {
    return CC_INDEX;
  }
}
