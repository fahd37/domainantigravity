const majesticCache = new Map<string, { data: MajesticMetrics; expiresAt: number }>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

export interface MajesticMetrics {
  trustFlow: number;
  citationFlow: number;
  tfCfRatio: number;
  isToxic: boolean;
}

export async function getMajesticMetrics(domain: string, apiKey = "free"): Promise<MajesticMetrics> {
  const cached = majesticCache.get(domain);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  const fallback: MajesticMetrics = { trustFlow: 0, citationFlow: 0, tfCfRatio: 1, isToxic: false };

  try {
    const url = `https://api.majestic.com/api/json?app_api_key=${apiKey}&cmd=GetIndexItemInfo&items=1&item0=${encodeURIComponent(domain)}&datasource=fresh`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });

    if (!res.ok) {
      console.warn(`[Majestic] API returned ${res.status} for ${domain}`);
      return fallback;
    }

    const data = await res.json();
    const item = data?.DataTables?.Results?.Data?.[0];

    if (!item) return fallback;

    const trustFlow: number = item.TrustFlow ?? 0;
    const citationFlow: number = item.CitationFlow ?? 0;
    const tfCfRatio = trustFlow / (citationFlow || 1);
    const isToxic = tfCfRatio < 0.3 && citationFlow > 10;

    const result: MajesticMetrics = { trustFlow, citationFlow, tfCfRatio, isToxic };
    majesticCache.set(domain, { data: result, expiresAt: Date.now() + CACHE_TTL });
    return result;
  } catch (err) {
    console.error(`[Majestic] Failed for ${domain}:`, err);
    return fallback;
  }
}
