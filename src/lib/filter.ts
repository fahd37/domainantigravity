export interface Niche {
  slug: string;
  keywords: string[];
  targetTlds: string[];
  active: boolean;
}

export interface NicheMatchResult {
  passes: boolean;
  matchedNiche: string | null;
  matchedKeywords: string[];
  reason: string;
}

export function filterDomain(domain: string, niches: Niche[]): NicheMatchResult {
  domain = domain.toLowerCase().trim();
  const tldIndex = domain.indexOf('.');
  
  if (tldIndex === -1) {
    return { passes: false, matchedNiche: null, matchedKeywords: [], reason: "Invalid domain format" };
  }

  const name = domain.substring(0, tldIndex);
  const tld = domain.substring(tldIndex);

  const activeNiches = niches.filter(n => n.active);

  for (const niche of activeNiches) {
    // 1. check keywords
    const matchedKeywords = niche.keywords.filter(kw => name.includes(kw.toLowerCase()));
    
    if (matchedKeywords.length > 0) {
      // 2. check TLD
      if (niche.targetTlds.includes(tld)) {
        return {
          passes: true,
          matchedNiche: niche.slug,
          matchedKeywords,
          reason: `Matched keywords (${matchedKeywords.join(', ')}) and TLD (${tld}) in niche '${niche.slug}'`
        };
      } else {
        return {
          passes: false,
          matchedNiche: niche.slug,
          matchedKeywords,
          reason: `Matched keywords but rejected due to TLD mismatch (got ${tld}, wanted ${niche.targetTlds.join(', ')})`
        };
      }
    }
  }

  return { passes: false, matchedNiche: null, matchedKeywords: [], reason: "No matching keywords found in active niches" };
}
