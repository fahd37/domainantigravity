import type { Niche } from "@/lib/filter";
import { checkWayback } from "@/lib/wayback";
import { scoreDomaain } from "@/lib/scorer";
import { filterDomain } from "@/lib/filter";

export interface WinningPattern {
  topTLDs: { tld: string; count: number }[];
  keywordLengths: { length: number; label: string; count: number }[];
  topKeywords: string[];
  avgDomainAge: number;
  avgReferringDomains: number;
  avgScore: number;
  totalAnalyzed: number;
  highValueCount: number;
}

export async function extractWinningPatterns(
  domains: string[],
  niches: Niche[] = []
): Promise<WinningPattern> {
  const tldCounts: Record<string, number> = {};
  const lengthCounts: Record<number, number> = { 1: 0, 2: 0, 3: 0 };
  const keywordCounts: Record<string, number> = {};
  let totalScore = 0;
  let highValue = 0;
  const totalAge = 0;

  // Process in parallel batches of 5
  const BATCH = 5;
  const scored: { domain: string; score: number }[] = [];

  for (let i = 0; i < Math.min(domains.length, 30); i += BATCH) {
    const batch = domains.slice(i, i + BATCH);
    const results = await Promise.allSettled(
      batch.map(async (domain) => {
        const wayback = await checkWayback(domain);
        const nicheMatch = filterDomain(domain, niches);
        const scoreResult = scoreDomaain(
          domain,
          wayback,
          { referringDomains: 0, backlinks: 0, domainScore: 0, spamScore: 0, ageYears: 0 },
          nicheMatch,
          55
        );
        return { domain, score: scoreResult.total };
      })
    );
    for (const r of results) {
      if (r.status === "fulfilled") scored.push(r.value);
    }
  }

  // Analyze high-value domains (score ≥ 60)
  const highValueDomains = scored.filter(d => d.score >= 60);

  for (const { domain, score } of highValueDomains) {
    totalScore += score;
    highValue++;

    const tldMatch = domain.match(/(\.[a-z]{2,})$/);
    if (tldMatch) tldCounts[tldMatch[1]] = (tldCounts[tldMatch[1]] || 0) + 1;

    const namePart = domain.split(".")[0];
    const words = namePart.split(/[-_]/).filter(w => w.length > 1);
    const wc = Math.min(words.length, 3) as 1 | 2 | 3;
    lengthCounts[wc] = (lengthCounts[wc] || 0) + 1;

    for (const w of words) {
      if (w.length > 3) keywordCounts[w] = (keywordCounts[w] || 0) + 1;
    }
  }

  const topTLDs = Object.entries(tldCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([tld, count]) => ({ tld, count }));

  const keywordLengthLabels: Record<number, string> = { 1: "Single word", 2: "Two words", 3: "Three+ words" };
  const keywordLengths = [1, 2, 3].map(len => ({
    length: len,
    label: keywordLengthLabels[len],
    count: lengthCounts[len] || 0,
  }));

  const topKeywords = Object.entries(keywordCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([kw]) => kw);

  return {
    topTLDs,
    keywordLengths,
    topKeywords,
    avgDomainAge: totalAge / (highValue || 1),
    avgReferringDomains: 0,
    avgScore: highValue > 0 ? totalScore / highValue : 0,
    totalAnalyzed: scored.length,
    highValueCount: highValue,
  };
}

export function patternToNicheConfig(
  pattern: WinningPattern,
  competitorDomain: string
): Omit<Niche, "active"> {
  const slug = `spy-${competitorDomain.split(".")[0]}-${Date.now().toString(36)}`;
  return {
    slug,
    keywords: pattern.topKeywords.slice(0, 10),
    targetTlds: pattern.topTLDs.slice(0, 4).map(t => t.tld),
  };
}
