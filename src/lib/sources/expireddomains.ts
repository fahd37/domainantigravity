export interface ExpiredDomain {
  domain: string;
  backlinks: number;
  referringDomains: number;
  age: string;
  source: string;
}

export async function scrapeExpiredDomains(keyword: string): Promise<ExpiredDomain[]> {
  try {
    await new Promise(resolve => setTimeout(resolve, 2000));

    const cleanKeyword = keyword.toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');

    const url = `https://www.expireddomains.net/domain-search/?q=${encodeURIComponent(cleanKeyword)}&flimit=100&ftlds[]=com&ftlds[]=net&ftlds[]=io&ftlds[]=de`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
      signal: AbortSignal.timeout(15000),
    });

    if (res.status === 403 || res.status === 429) {
      console.warn(`[ExpiredDomains] Blocked (${res.status}) for keyword: ${keyword}`);
      return [];
    }

    if (!res.ok) return [];

    const html = await res.text();
    const results: ExpiredDomain[] = [];

    // Use Array.from for TS compatibility
    const rowPattern = /<tr[^>]*class="[^"]*"[^>]*>([\s\S]*?)<\/tr>/gi;
    const rowMatches = Array.from(html.matchAll(rowPattern));

    for (const row of rowMatches) {
      const rowHtml = row[1];
      const domainMatch = rowHtml.match(/class="[^"]*domain[^"]*"[^>]*>.*?<a[^>]*>([a-z0-9.-]+\.[a-z]{2,})<\/a>/i);
      const cellPattern = /<td[^>]*>([\s\S]*?)<\/td>/gi;
      const cells = Array.from(rowHtml.matchAll(cellPattern)).map(m =>
        m[1].replace(/<[^>]+>/g, "").trim()
      );

      if (domainMatch?.[1] && cells.length >= 3) {
        results.push({
          domain: domainMatch[1].toLowerCase(),
          backlinks: parseInt(cells[1]) || 0,
          referringDomains: parseInt(cells[2]) || 0,
          age: cells[3] || "unknown",
          source: "expireddomains",
        });
      }

      if (results.length >= 50) break;
    }

    return results;
  } catch (err) {
    console.warn(`[ExpiredDomains] Error for keyword "${keyword}":`, err);
    return [];
  }
}
