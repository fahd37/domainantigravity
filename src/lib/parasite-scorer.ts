import { GoogleIndexResult } from "./google-index";
import { AnchorRelevanceResult } from "./anchor-relevance";
import { KeywordHistoryResult, KeywordHistoryItem } from "./keyword-history";
import { NicheMatchResult } from "./filter";

export interface WaybackResult {
  snapshotCount: number;
  lastArchived: Date | null;
  avgWordCount: number;
}

export interface DataForSeoResult {
  referringDomains: number;
  backlinks: number;
  domainScore: number;
  spamScore: number;
  ageYears: number;
}

export interface MajesticResult {
  isToxic: boolean;
  tfCfRatio: number;
  citationFlow: number;
  trustFlow: number;
}

export interface Settings {
  buyThreshold: number;
}

export interface ParasiteScore {
  total: number;
  recommendation: 'buy' | 'watch' | 'reject';
  breakdown: {
    googleIndex: number;
    topicalAuthority: number;
    anchorRelevance: number;
    keywordHistory: number;
    age: number;
  };
  parasiteReadiness: 'HIGH' | 'MEDIUM' | 'LOW';
  topKeywordsToTarget: KeywordHistoryItem[];
  reason?: string;
}

export function scoreParasiteDomain(params: {
  domain: string;
  googleIndex: GoogleIndexResult;
  wayback: WaybackResult;
  dataForSeo: DataForSeoResult;
  anchorRelevance: AnchorRelevanceResult;
  keywordHistory: KeywordHistoryResult;
  majestic: MajesticResult;
  nicheMatch: NicheMatchResult;
  settings: Settings;
}): ParasiteScore {

  const reject = (reason: string): ParasiteScore => ({
    total: 0,
    recommendation: 'reject',
    breakdown: { googleIndex: 0, topicalAuthority: 0, anchorRelevance: 0, keywordHistory: 0, age: 0 },
    parasiteReadiness: 'LOW',
    topKeywordsToTarget: [],
    reason
  });

  // ══════════════════════════════════════
  // HARD REJECTIONS — instant 0, no appeal
  // ══════════════════════════════════════
  if (!params.googleIndex.indexed) 
    return reject('Deindexed by Google');
  
  if (params.majestic.tfCfRatio < 0.3 && params.majestic.citationFlow > 10)
    return reject('Toxic link profile');
  
  if (params.wayback.avgWordCount < 200 && params.wayback.snapshotCount > 10)
    return reject('Thin content history');
  
  if (params.dataForSeo.referringDomains < 3)
    return reject('Insufficient backlinks');

  // ══════════════════════════════════════
  // SCORING (max 100 pts)
  // ══════════════════════════════════════
  
  // 1. Google trust (50pts max) — MOST IMPORTANT for parasite SEO
  const googleScore = params.googleIndex.indexScore;  // 0-50

  // 2. Topical authority (20pts max)
  const exactMatch = params.nicheMatch.matchedKeywords.some(kw => params.domain.toLowerCase().includes(kw));
  const partialMatch = params.nicheMatch.passes; 
  // Above is a simplified approximation: exactMatch meaning exact string match.
  const topicalScore = exactMatch ? 20 : (partialMatch ? 10 : 0);

  // 3. Anchor relevance (15pts max)  
  const anchorScore = params.anchorRelevance.anchorScore;  // 0-15

  // 4. Keyword history (10pts max)
  // Normalizing to 10pts max: trafficScore max is 20, so divide by 2
  const keywordScore = Math.min(10, Math.floor(params.keywordHistory.trafficScore / 2));

  // 5. Domain age (5pts max) — less important for parasite
  const ageScore = params.dataForSeo.ageYears >= 8 ? 5 
    : params.dataForSeo.ageYears >= 4 ? 3 : 1;

  // Total
  const total = googleScore + topicalScore + anchorScore + keywordScore + ageScore;

  // Recommendation thresholds
  const threshold = params.settings.buyThreshold || 60;
  const recommendation = total >= threshold ? 'buy' 
    : total >= 40 ? 'watch' : 'reject';

  return {
    total,
    recommendation,
    breakdown: {
      googleIndex: googleScore,
      topicalAuthority: topicalScore,
      anchorRelevance: anchorScore,
      keywordHistory: keywordScore,
      age: ageScore
    },
    parasiteReadiness: total >= 70 ? 'HIGH' : (total >= 50 ? 'MEDIUM' : 'LOW'),
    topKeywordsToTarget: params.keywordHistory.topKeywords.slice(0, 5),
    reason: recommendation === 'reject' ? 'Score too low' : undefined
  };
}
