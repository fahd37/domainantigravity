interface CacheEntry {
  data: { snapshotCount: number; lastArchived: Date | null; score: number };
  expiresAt: number;
}

const waybackCache = new Map<string, CacheEntry>();
const contentCache = new Map<string, { data: WaybackContent; expiresAt: number }>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

export interface WaybackContent {
  contentMatchesNiche: boolean;
  contentSample: string;
  detectedTopics: string[];
}

export async function checkWayback(domain: string) {
  const cached = waybackCache.get(domain);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  try {
    const url = `https://web.archive.org/cdx/search/cdx?url=${domain}&output=json&limit=250&fl=timestamp,statuscode&filter=statuscode:200`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    
    if (!res.ok) {
      throw new Error(`Wayback API error: ${res.status}`);
    }

    const text = await res.text();
    if (!text.trim()) {
      const result = { snapshotCount: 0, lastArchived: null, score: 0 };
      waybackCache.set(domain, { data: result, expiresAt: Date.now() + CACHE_TTL });
      return result;
    }

    const data = JSON.parse(text);
    let snapshotCount = 0;
    let lastArchived: Date | null = null;
    let latestTimestamp = "";

    if (Array.isArray(data) && data.length > 1) {
      snapshotCount = data.length - 1;
      
      const lastRow = data[data.length - 1];
      const timestampStr = lastRow[0];
      if (typeof timestampStr === 'string' && timestampStr.length >= 8) {
        latestTimestamp = timestampStr;
        const year = parseInt(timestampStr.substring(0, 4));
        const month = parseInt(timestampStr.substring(4, 6)) - 1;
        const day = parseInt(timestampStr.substring(6, 8));
        lastArchived = new Date(year, month, day);
      }
    }

    let score = 0;
    if (snapshotCount === 0) score = 0;
    else if (snapshotCount <= 10) score = 15;
    else if (snapshotCount <= 50) score = 30;
    else if (snapshotCount <= 200) score = 45;
    else score = 60;

    if (lastArchived) {
      const twoYearsAgo = new Date();
      twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
      if (lastArchived > twoYearsAgo) {
        score += 10;
      }
    }

    const result = { snapshotCount, lastArchived, score, latestTimestamp };
    waybackCache.set(domain, { data: result, expiresAt: Date.now() + CACHE_TTL });
    return result;

  } catch (error) {
    console.error(`Wayback check failed for ${domain}:`, error);
    return { snapshotCount: 0, lastArchived: null, score: 0, latestTimestamp: "" };
  }
}

export async function checkWaybackContent(domain: string, nicheKeywords: string[]): Promise<WaybackContent> {
  const cacheKey = `${domain}:${nicheKeywords.join(",")}`;
  const cached = contentCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  const fallback: WaybackContent = { contentMatchesNiche: false, contentSample: "", detectedTopics: [] };

  try {
    // Get latest snapshot timestamp first
    const cdxUrl = `https://web.archive.org/cdx/search/cdx?url=${domain}&output=json&limit=1&fl=timestamp&filter=statuscode:200&output=json`;
    const cdxRes = await fetch(cdxUrl, { signal: AbortSignal.timeout(5000) });
    if (!cdxRes.ok) return fallback;
    const cdxData = await cdxRes.json();
    if (!Array.isArray(cdxData) || cdxData.length < 2) return fallback;

    const timestamp = cdxData[1][0];
    const snapshotUrl = `https://web.archive.org/web/${timestamp}/${domain}`;

    const htmlRes = await fetch(snapshotUrl, {
      signal: AbortSignal.timeout(5000),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; DomainHunterBot/1.0)" },
    });

    if (!htmlRes.ok) return fallback;

    const html = await htmlRes.text();
    // Strip HTML tags
    const text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();

    const contentSample = text.substring(0, 200);
    const detectedTopics: string[] = [];
    let contentMatchesNiche = false;

    for (const keyword of nicheKeywords) {
      if (text.includes(keyword.toLowerCase())) {
        detectedTopics.push(keyword);
        contentMatchesNiche = true;
      }
    }

    const result: WaybackContent = { contentMatchesNiche, contentSample, detectedTopics };
    contentCache.set(cacheKey, { data: result, expiresAt: Date.now() + CACHE_TTL });
    return result;
  } catch {
    // Timeout or fetch error — skip content check gracefully
    return fallback;
  }
}
