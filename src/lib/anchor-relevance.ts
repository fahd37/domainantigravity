export interface AnchorItem {
  text: string;
  referringDomains: number;
  isRelevant: boolean;
}

export interface AnchorRelevanceResult {
  anchorScore: number;
  relevanceRatio: number;
  relevantAnchors: number;
  totalAnchors: number;
  topAnchors: AnchorItem[];
  dominantTopic: string;
}

export async function checkAnchorRelevance(domain: string, nicheKeywords: string[], email: string, password: string): Promise<AnchorRelevanceResult> {
  const credentials = Buffer.from(`${email}:${password}`).toString("base64");
  
  try {
    const res = await fetch("https://api.dataforseo.com/v3/backlinks/anchors/live", {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([{
        target: domain,
        limit: 50,
        mode: "as_is",
        filters: ["referring_domains", ">", 1]
      }]),
    });

    if (!res.ok) {
      console.warn(`[DataForSEO] Anchor relevance check failed: ${res.status}`);
      return { anchorScore: 0, relevanceRatio: 0, relevantAnchors: 0, totalAnchors: 0, topAnchors: [], dominantTopic: "" };
    }

    const data = await res.json();
    const items = data?.tasks?.[0]?.result?.[0]?.items || [];

    const anchors: { anchor: string; referring_domains: number; backlinks: number }[] = items;

    // Clean anchors
    const meaningfulAnchors = anchors.filter(a => {
      if (!a.anchor) return false;
      const text = a.anchor.toLowerCase();
      // Must be > 1 word, or we can check length. The prompt said > 1 word:
      // a.anchor.split(' ').length > 1
      if (a.anchor.split(' ').length <= 1) return false;
      
      const stopWords = ['click here', 'read more', 'visit', 'here', 'link'];
      if (stopWords.includes(text)) return false;
      
      // Also exclude raw URLs roughly
      if (text.includes('http') || text.includes('www.')) return false;
      
      return true;
    });

    // Score niche relevance
    const relevantAnchors = meaningfulAnchors.filter(a =>
      nicheKeywords.some(kw => a.anchor.toLowerCase().includes(kw.toLowerCase()))
    );

    const relevanceRatio = relevantAnchors.length / (meaningfulAnchors.length || 1);

    // Anchor score max 15pts
    const anchorScore = Math.min(15, Math.floor(relevanceRatio * 15));

    // Find dominant topic (most frequent keyword among relevant anchors)
    const topicCounts: Record<string, number> = {};
    for (const a of relevantAnchors) {
      for (const kw of nicheKeywords) {
        if (a.anchor.toLowerCase().includes(kw.toLowerCase())) {
          topicCounts[kw] = (topicCounts[kw] || 0) + a.referring_domains;
        }
      }
    }
    const dominantTopic = Object.entries(topicCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "";

    // Top anchors for display
    const topAnchors = anchors
      .sort((a, b) => b.referring_domains - a.referring_domains)
      .slice(0, 10)
      .map(a => ({
        text: a.anchor || "Empty Anchor",
        referringDomains: a.referring_domains,
        isRelevant: relevantAnchors.includes(a)
      }));

    return {
      anchorScore,
      relevanceRatio,
      relevantAnchors: relevantAnchors.length,
      totalAnchors: meaningfulAnchors.length,
      topAnchors,
      dominantTopic
    };

  } catch (error) {
    console.warn(`[DataForSEO] Error checking anchors for ${domain}:`, error);
    return { anchorScore: 0, relevanceRatio: 0, relevantAnchors: 0, totalAnchors: 0, topAnchors: [], dominantTopic: "" };
  }
}
