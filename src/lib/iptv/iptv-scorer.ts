import { IPTV_DOMAIN_PATTERNS, MARKET_TLD_PREFERENCES } from './keyword-database'

export interface GoogleIndexResult {
  indexed: boolean
  pageCount: number
}

export interface WaybackResult {
  contentSample: string | null
}

export interface DataForSeoResult {
  ageYears: number
}

export interface MajesticResult {
  trustFlow: number
  citationFlow: number
  tfCfRatio: number
}

export interface IPTVScore {
  total: number
  patternScore: number
  tldScore: number
  waybackIPTVScore: number
  googleScore: number
  ageScore: number
  matchedPatterns: string[]
  previouslyIPTV: boolean
  parasiteReadiness: string
  estimatedMonthlyRevenue: number
  estimatedDaysToRank: number
  recommendation: string
  marketFit: string
}

function reject(reason: string, score: number): IPTVScore {
  return {
    total: score,
    patternScore: 0,
    tldScore: 0,
    waybackIPTVScore: 0,
    googleScore: 0,
    ageScore: 0,
    matchedPatterns: [],
    previouslyIPTV: false,
    parasiteReadiness: 'LOW',
    estimatedMonthlyRevenue: 0,
    estimatedDaysToRank: 999,
    recommendation: 'reject',
    marketFit: 'WEAK'
  }
}

function getMarketData() {
  // Default values based on the prompt's context
  return {
    avgRPM: 1.5,
    avgCommission: 35
  }
}

export function scoreIPTVDomain(params: {
  domain: string
  googleIndex: GoogleIndexResult
  wayback: WaybackResult
  dataForSeo: DataForSeoResult
  majestic: MajesticResult
  targetMarket: string
  language: string
}): IPTVScore {

  const domainName = params.domain.split('.')[0].toLowerCase()
  const tld = '.' + params.domain.split('.').slice(1).join('.')

  // ══════════════════════════════════
  // HARD REJECTIONS
  // ══════════════════════════════════
  if (!params.googleIndex.indexed)
    return reject('Deindexed', 0)
  if (params.majestic.tfCfRatio < 0.3 && params.majestic.citationFlow > 10)
    return reject('Toxic links', 0)

  // ══════════════════════════════════
  // IPTV SPECIFIC SIGNALS
  // ══════════════════════════════════

  // Signal 1: Domain name contains IPTV keywords (40pts max)
  const iptvPatterns = IPTV_DOMAIN_PATTERNS
  const matchedPatterns = iptvPatterns.filter(p => domainName.includes(p))
  const patternScore = Math.min(40, matchedPatterns.length * 15)

  // Signal 2: TLD matches market preference (10pts)
  const marketTLDs = MARKET_TLD_PREFERENCES[params.targetMarket] || ['.com']
  const tldScore = marketTLDs.indexOf(tld) === 0 ? 10
    : marketTLDs.indexOf(tld) === 1 ? 7
    : marketTLDs.includes(tld) ? 4 : 0

  // Signal 3: Previous IPTV content in Wayback (30pts max)
  const iptvWaybackKeywords = ['iptv', 'stream', 'channel', 'playlist', 'm3u',
    'live tv', 'television', 'canaux', 'kanäle', 'kanalen', 'kanaler']
  const contentMatchCount = iptvWaybackKeywords.filter(kw =>
    params.wayback.contentSample?.toLowerCase().includes(kw)
  ).length
  const waybackIPTVScore = Math.min(30, contentMatchCount * 8)

  // Signal 4: Google trust (15pts max)
  const googleScore = Math.min(15,
    params.googleIndex.pageCount > 20 ? 15
    : params.googleIndex.pageCount > 5 ? 10
    : params.googleIndex.pageCount > 0 ? 5 : 0
  )

  // Signal 5: Domain age (5pts)
  const ageScore = params.dataForSeo.ageYears >= 5 ? 5
    : params.dataForSeo.ageYears >= 3 ? 3 : 1

  // Total
  const total = patternScore + tldScore + waybackIPTVScore + googleScore + ageScore

  // Estimate monthly revenue
  const marketData = getMarketData()
  const estimatedMonthly = total >= 70
    ? marketData.avgRPM * 500 + (marketData.avgCommission * 3)
    : total >= 50
    ? marketData.avgRPM * 200 + (marketData.avgCommission * 1)
    : marketData.avgRPM * 50

  // Estimate days to rank
  const daysToRank = total >= 75 ? 3
    : total >= 60 ? 5
    : total >= 45 ? 10
    : 21

  return {
    total,
    patternScore,
    tldScore,
    waybackIPTVScore,
    googleScore,
    ageScore,
    matchedPatterns,
    previouslyIPTV: waybackIPTVScore > 15,
    parasiteReadiness: total >= 70 ? 'HIGH' : total >= 50 ? 'MEDIUM' : 'LOW',
    estimatedMonthlyRevenue: estimatedMonthly,
    estimatedDaysToRank: daysToRank,
    recommendation: total >= 60 ? 'buy' : total >= 40 ? 'watch' : 'reject',
    marketFit: tldScore >= 7 ? 'PERFECT' : tldScore >= 4 ? 'GOOD' : 'WEAK'
  }
}
