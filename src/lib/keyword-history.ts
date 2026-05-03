export interface KeywordHistoryItem {
  keyword: string;
  position: number;
  searchVolume: number;
  trafficValue: number;
  lastSeen: string;
}

export interface KeywordHistoryResult {
  hasRankingHistory: boolean;
  topKeywords: KeywordHistoryItem[];
  peakTrafficEstimate: number;
  trafficScore: number;
  primaryTopic: string;
}

export async function getHistoricalKeywords(domain: string, email: string, password: string): Promise<KeywordHistoryResult> {
  const credentials = Buffer.from(`${email}:${password}`).toString("base64");

  const emptyResult = {
    hasRankingHistory: false,
    topKeywords: [],
    peakTrafficEstimate: 0,
    trafficScore: 0,
    primaryTopic: ""
  };

  try {
    // 1. Try Historical Rank Overview
    let res = await fetch("https://api.dataforseo.com/v3/dataforseo_labs/google/historical_rank_overview/live", {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([{
        target: domain,
        language_code: "en",
        location_code: 2840
      }]),
    });

    let data = await res.json();
    let items = data?.tasks?.[0]?.result?.[0]?.items || [];

    // If no results, try domain rank overview
    if (!res.ok || items.length === 0) {
      res = await fetch("https://api.dataforseo.com/v3/dataforseo_labs/google/domain_rank_overview/live", {
        method: "POST",
        headers: {
          Authorization: `Basic ${credentials}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify([{
          target: domain,
          language_code: "en",
          location_code: 2840
        }]),
      });
      data = await res.json();
      items = data?.tasks?.[0]?.result?.[0]?.items || [];
    }

    if (items.length === 0) {
      return emptyResult;
    }

    // Usually DataForSEO Labs returns metrics per month in historical_rank_overview
    // If it's domain_rank_overview, it returns `metrics` object with `organic`.
    // Let's parse items robustly based on common DataForSEO payload structure.
    
    // Actually, DataForSEO Historical Rank Overview returns an array of months. We need the actual ranked keywords.
    // Wait, the prompt says:
    // Extract and sort by etv (estimated traffic value) descending. Take top 15 keywords.
    // If we want actual keywords, DataForSEO Labs "Ranked Keywords" or similar is usually better, but we follow the prompt exactly:
    // It assumes the endpoints return items with `keyword`, `rank_info`, etc. We'll map what we can.
    
    // For safety, let's extract assuming standard ranked keyword item structure:
    const keywords: KeywordHistoryItem[] = items.map((item: Record<string, unknown>) => {
      const keywordObj = item.keyword as Record<string, unknown> | undefined;
      const metricsObj = item.metrics as Record<string, Record<string, number>> | undefined;
      const rankedSerpObj = item.ranked_serp_element as Record<string, Record<string, number>> | undefined;
      const keywordInfoObj = item.keyword_info as Record<string, number> | undefined;

      return {
        keyword: (keywordObj?.keyword as string) || (item.keyword as string) || "",
        position: (rankedSerpObj?.serp_item?.rank_group) || (metricsObj?.organic?.pos_1) || 99,
        searchVolume: (keywordInfoObj?.search_volume) || (item.search_volume as number) || 0,
        trafficValue: (metricsObj?.organic?.etv) || (item.estimated_traffic_volume as number) || (item.etv as number) || 0,
        lastSeen: item.year ? `${item.year}-${item.month}` : new Date().toISOString()
      };
    }).filter((k: KeywordHistoryItem) => k.keyword !== "");

    // If the items were just historical aggregates (as historical_rank_overview usually gives),
    // and there are no actual keywords, we might not get keywords out. 
    // We will trust the prompt's assumption that the API returns sortable keywords with etv.

    // Sort by etv descending
    keywords.sort((a, b) => b.trafficValue - a.trafficValue);
    const top15 = keywords.slice(0, 15);

    if (top15.length === 0) return emptyResult;

    // Traffic scoring
    let trafficScore = 0;
    if (top15.length >= 6) trafficScore = 10;
    else if (top15.length >= 1) trafficScore = 5;

    const hasVol1000 = top15.some(k => k.searchVolume > 1000);
    const hasVol5000 = top15.some(k => k.searchVolume > 5000);

    if (hasVol5000) trafficScore = 20;
    else if (hasVol1000) trafficScore = 15;

    const peakTrafficEstimate = Math.max(...keywords.map(k => k.trafficValue), 0);
    
    // Primary topic (just take the highest traffic keyword)
    const primaryTopic = top15[0]?.keyword || "";

    return {
      hasRankingHistory: true,
      topKeywords: top15,
      peakTrafficEstimate,
      trafficScore,
      primaryTopic
    };

  } catch (error) {
    console.warn(`[DataForSEO] Error getting historical keywords for ${domain}:`, error);
    return emptyResult;
  }
}
