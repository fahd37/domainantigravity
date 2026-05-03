export interface SourceDomain {
  domain: string;
  price?: number;
  source: string;
}

export async function scrapeNamecheapMarketplace(keywords: string[]): Promise<SourceDomain[]> {
  const results: SourceDomain[] = [];

  for (const keyword of keywords) {
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      const url = `https://www.namecheap.com/domains/marketplace/?q=${encodeURIComponent(keyword)}`;
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; DomainHunterBot/1.0)" },
        signal: AbortSignal.timeout(10000),
      });

      if (res.status === 403 || res.status === 429) {
        console.warn(`[NamecheapMarketplace] Blocked (${res.status}) for keyword: ${keyword}`);
        continue;
      }

      if (!res.ok) continue;

      const html = await res.text();

      // Parse domain links from marketplace listings
      const domainMatches = html.match(/class="[^"]*domain[^"]*"[^>]*>([a-z0-9.-]+\.[a-z]{2,})/gi) || [];
      const priceMatches = html.match(/\$[\d,.]+/g) || [];

      domainMatches.slice(0, 20).forEach((match, i) => {
        const domainMatch = match.match(/([a-z0-9-]+\.[a-z]{2,})/i);
        if (domainMatch?.[1] && domainMatch[1].includes(".")) {
          const priceStr = priceMatches[i]?.replace(/[$,]/g, "");
          results.push({
            domain: domainMatch[1].toLowerCase(),
            price: priceStr ? parseFloat(priceStr) : undefined,
            source: "namecheap-marketplace",
          });
        }
      });
    } catch (err) {
      console.warn(`[NamecheapMarketplace] Error for keyword "${keyword}":`, err);
    }
  }

  return results;
}
