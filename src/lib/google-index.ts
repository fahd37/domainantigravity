import { rateLimiter } from "./rate-limiter";
import { withCache } from "./cache";

export interface GoogleIndexResult {
  indexed: boolean;
  pageCount: number;
  indexScore: number;
  sampleUrls: string[];
  lastChecked: Date;
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Parses search result HTML (Google or Bing) for page count and URLs.
 */
function parseSearchResults(html: string, domain: string): { pageCount: number; sampleUrls: string[] } {
  let pageCount = 0;
  
  // Pattern 1: About x results (Google) or x results (Bing)
  const aboutMatch = html.match(/(?:About\s+)?([0-9,]+)\s+results/i);
  if (aboutMatch) {
    pageCount = parseInt(aboutMatch[1].replace(/,/g, ''), 10);
  } else {
    // Pattern 3: count of <h3 tags
    const h3Match = html.match(/<h3/g);
    if (h3Match) {
      pageCount = h3Match.length;
    }
  }

  // Extract sample URLs
  const sampleUrls: string[] = [];
  const urlMatches = html.matchAll(/href="(https?:\/\/(?:www\.)?[^"&]+)/g);
  for (const match of Array.from(urlMatches)) {
    const parsedUrl = match[1];
    if (parsedUrl.includes(domain) && !parsedUrl.includes('google.com') && !parsedUrl.includes('bing.com') && sampleUrls.length < 3) {
      sampleUrls.push(parsedUrl);
    }
    if (sampleUrls.length >= 3) break;
  }

  return { pageCount, sampleUrls };
}

async function performCheck(domain: string): Promise<GoogleIndexResult> {
  const googleUrl = `https://www.google.com/search?q=site:${encodeURIComponent(domain)}&num=10`;
  const bingUrl = `https://www.bing.com/search?q=site:${encodeURIComponent(domain)}`;
  
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'text/html',
    'Accept-Language': 'en-US,en;q=0.9',
    'Cache-Control': 'no-cache'
  };

  try {
    // 1. Try Google
    await rateLimiter.acquire("google").catch(() => delay(1000));
    let res = await fetch(googleUrl, { headers, signal: AbortSignal.timeout(8000) });

    // 2. Exponential Backoff: If 429/403, wait 10s and retry ONCE
    if (res.status === 429 || res.status === 403) {
      console.warn(`[Google Index] Rate limited for ${domain}. Waiting 10s backoff...`);
      await delay(10000);
      res = await fetch(googleUrl, { headers, signal: AbortSignal.timeout(8000) });
    }

    // 3. Fallback to Bing if Google still fails
    if (!res.ok) {
      console.warn(`[Google Index] Google check failed (HTTP ${res.status}), falling back to Bing for ${domain}`);
      res = await fetch(bingUrl, { headers, signal: AbortSignal.timeout(8000) });
      
      if (!res.ok) {
        throw new Error(`Both Google and Bing checks failed for ${domain}`);
      }
    }

    const html = await res.text();
    const { pageCount, sampleUrls } = parseSearchResults(html, domain);

    const indexed = pageCount > 0;
    let indexScore = 0;
    if (pageCount === 0) indexScore = 0;
    else if (pageCount <= 5) indexScore = 20;
    else if (pageCount <= 20) indexScore = 35;
    else if (pageCount <= 50) indexScore = 45;
    else indexScore = 50;

    return { 
      indexed, 
      pageCount, 
      indexScore, 
      sampleUrls, 
      lastChecked: new Date() 
    };
  } catch (error) {
    console.warn(`[Google Index] Error checking ${domain}, using neutral fallback:`, error);
    return {
      indexed: true,
      pageCount: -1,
      indexScore: 25,
      sampleUrls: [],
      lastChecked: new Date()
    };
  }
}

export async function checkGoogleIndex(domain: string): Promise<GoogleIndexResult> {
  return withCache('google', domain, () => performCheck(domain));
}
