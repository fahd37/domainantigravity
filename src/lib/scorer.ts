import type { LinkQualityReport } from "@/lib/link-quality";

export function scoreDomaain(
  domain: string,
  waybackResult: { snapshotCount: number; lastArchived: Date | null; score: number },
  dataForSeoResult: { referringDomains: number; backlinks: number; domainScore: number; spamScore: number; ageYears?: number },
  nicheMatch: { passes: boolean; matchedNiche: string | null; matchedKeywords: string[] },
  buyThreshold: number = 55,
  majesticResult?: { isToxic: boolean; tfCfRatio: number },
  contentResult?: { contentMatchesNiche: boolean; snapshotCount: number },
  linkQuality?: LinkQualityReport,
  googleIndexResult?: { indexed: boolean; indexScore: number }
) {
  // Instant reject: spam score, Majestic toxicity, toxic link profile, or deindexed from Google
  if (
    dataForSeoResult.spamScore >= 100 ||
    majesticResult?.isToxic ||
    linkQuality?.verdict === "toxic" ||
    (googleIndexResult && !googleIndexResult.indexed)
  ) {
    return {
      total: 0,
      breakdown: { wayback: 0, seo: 0, niche: 0, age: 0, tld: 0, domainAge: 0, linkQuality: 0 },
      recommendation: "reject" as const,
    };
  }

  let ageBonus = 0;
  if (waybackResult.lastArchived) {
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
    if (waybackResult.lastArchived > twoYearsAgo) {
      ageBonus = 10;
    }
  }

  // Domain registration age bonus
  let domainAgeBonus = 0;
  const ageYears = dataForSeoResult.ageYears || 0;
  if (ageYears >= 13) domainAgeBonus = 20;
  else if (ageYears >= 8) domainAgeBonus = 15;
  else if (ageYears >= 4) domainAgeBonus = 10;
  else if (ageYears >= 1) domainAgeBonus = 5;

  // Base wayback score without age bonus
  const baseWayback = waybackResult.score - ageBonus;

  // Niche exact match bonus
  let nicheBonus = 0;
  const tldIndex = domain.indexOf('.');
  const name = tldIndex !== -1 ? domain.substring(0, tldIndex).toLowerCase() : domain.toLowerCase();

  if (nicheMatch.passes && nicheMatch.matchedKeywords.includes(name)) {
    nicheBonus = 10;
  }

  // Wayback content niche verification adjustment
  let contentAdjustment = 0;
  if (contentResult) {
    if (contentResult.contentMatchesNiche) {
      contentAdjustment = 10;
    } else if (contentResult.snapshotCount > 20) {
      contentAdjustment = -20;
    }
  }

  // TLD bonus
  let tldBonus = 2;
  const tld = tldIndex !== -1 ? domain.substring(tldIndex).toLowerCase() : "";
  if (tld === ".com") tldBonus = 5;
  else if (tld === ".de" || tld === ".co.uk") tldBonus = 4;
  else if (tld === ".io") tldBonus = 3;

  // Link quality bonus (max 20pts — quality score * 0.2)
  const linkQualityBonus = linkQuality ? Math.min(20, Math.round(linkQuality.qualityScore * 0.2)) : 0;

  // Google Index bonus
  const indexBonus = googleIndexResult?.indexScore || 0;

  const total = Math.max(0, Math.min(100,
    baseWayback + dataForSeoResult.domainScore + nicheBonus + tldBonus +
    ageBonus + domainAgeBonus + contentAdjustment + linkQualityBonus + indexBonus
  ));

  let recommendation: "buy" | "skip" | "reject" = "reject";
  if (total >= buyThreshold) {
    recommendation = "buy";
  } else if (total >= 40) {
    recommendation = "skip";
  }

  return {
    total,
    breakdown: {
      wayback: baseWayback,
      seo: dataForSeoResult.domainScore,
      niche: nicheBonus,
      age: ageBonus,
      tld: tldBonus,
      domainAge: domainAgeBonus,
      linkQuality: linkQualityBonus,
      googleIndex: indexBonus,
    },
    recommendation,
  };
}
