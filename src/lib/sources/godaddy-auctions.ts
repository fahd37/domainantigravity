export interface GoDaddyAuction {
  domain: string;
  currentBid: number;
  bidCount: number;
  hoursRemaining: number;
  endTime: string;
  listingId: string;
  source: "godaddy-auction";
}

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

export async function scrapeGoDaddyAuctions(keywords: string[]): Promise<GoDaddyAuction[]> {
  const results: GoDaddyAuction[] = [];
  const seen = new Set<string>();

  for (const keyword of keywords) {
    try {
      await delay(2000);

      // Try JSON API first with real browser headers
      const apiUrl = `https://auctions.godaddy.com/api/v1/auctions?q=${encodeURIComponent(keyword)}&pageSize=100&sortBy=EndTime&sortOrder=ASC`;
      let res = await fetch(apiUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          "Accept": "application/json",
          "Referer": "https://auctions.godaddy.com/",
          "Origin": "https://auctions.godaddy.com",
          "Accept-Language": "en-US,en;q=0.9"
        },
        signal: AbortSignal.timeout(12000),
      });

      let data;
      if (res.ok) {
        data = await res.json();
      }

      // Fallback to public aftermarket API if blocked or empty
      if (!res.ok || !data?.items?.length) {
        const publicApiUrl = `https://api.godaddy.com/v1/domains/aftermarket/listings/expiry?keywords=${encodeURIComponent(keyword)}&pageSize=50`;
        res = await fetch(publicApiUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            "Accept": "application/json"
          },
          signal: AbortSignal.timeout(12000),
        });
        if (res.ok) {
          data = await res.json();
        }
      }

      if (data) {
        const auctions = data.items || data.auctions || data.results || data.listings || [];

        for (const item of auctions) {
          const domain: string = item.domain || item.name || item.domainName || "";
          if (!domain || seen.has(domain)) continue;
          seen.add(domain);

          const endTime: string = item.endTime || item.expiresAt || item.closeDate || "";
          const hoursRemaining = endTime
            ? Math.max(0, (new Date(endTime).getTime() - Date.now()) / 3600000)
            : 999;

          // Only include auctions ending within 48 hours
          if (hoursRemaining > 48) continue;

          results.push({
            domain,
            currentBid: item.currentBid ?? item.price ?? item.currentPrice ?? 0,
            bidCount: item.bidCount ?? item.bids ?? 0,
            hoursRemaining: parseFloat(hoursRemaining.toFixed(1)),
            endTime,
            listingId: String(item.listingId ?? item.id ?? item.auctionId ?? domain),
            source: "godaddy-auction",
          });
        }
      }
    } catch (err) {
      console.warn(`[GoDaddy] Fetch failed for "${keyword}":`, err);
    }
  }

  return results;
}
