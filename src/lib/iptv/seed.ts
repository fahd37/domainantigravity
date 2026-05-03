import { prisma } from '../prisma'
import { IPTV_KEYWORD_DATABASE } from './keyword-database'

async function main() {
  console.log('Seeding IPTV Market Analysis and Keyword Database...')

  // Seed Keywords
  for (const [, data] of Object.entries(IPTV_KEYWORD_DATABASE)) {
    console.log(`Seeding keywords for ${data.market} (${data.language})...`)
    
    for (const kw of data.keywords) {
      await prisma.iPTVKeywordDatabase.upsert({
        where: { id: `${data.market}-${kw.keyword}`.replace(/\s+/g, '-') },
        update: {
          keyword: kw.keyword,
          language: data.language,
          market: data.market,
          searchVolume: kw.volume,
          cpc: kw.cpc,
          difficulty: kw.difficulty,
          trend: 'STABLE',
          category: kw.category,
          isMoneyKw: kw.isMoneyKw,
        },
        create: {
          id: `${data.market}-${kw.keyword}`.replace(/\s+/g, '-'),
          keyword: kw.keyword,
          language: data.language,
          market: data.market,
          searchVolume: kw.volume,
          cpc: kw.cpc,
          difficulty: kw.difficulty,
          trend: 'STABLE',
          category: kw.category,
          isMoneyKw: kw.isMoneyKw,
        }
      })
    }

    // The random market seeding logic is removed from here
    console.log(`Finished seeding keywords for ${data.market}`)
  }

  const IPTV_MARKET_DATA = [
    {
      market: 'US',
      language: 'en',
      totalKeywords: 180000,
      avgCPC: 1.40,
      topKeyword: 'best iptv service 2026',
      topKeywordVol: 1800000,
      competitorCount: 890,
      difficulty: 'MEDIUM',
      opportunity: 'HOT',
      expiredAvailable: 2840,
      successRate: 68,
      avgDaysToRank: 7,
      estimatedRPM: 18,
      topTLDs: ['.com', '.net', '.io', '.tv'],
      topKeywords: [
        { keyword: 'best iptv service 2026', volume: 1800000, cpc: 1.40, difficulty: 32 },
        { keyword: 'iptv subscription', volume: 1200000, cpc: 1.20, difficulty: 28 },
        { keyword: 'best iptv for firestick', volume: 823000, cpc: 1.10, difficulty: 30 },
        { keyword: 'iptv free trial', volume: 673000, cpc: 1.30, difficulty: 29 },
        { keyword: 'cheap iptv service', volume: 550000, cpc: 0.90, difficulty: 26 }
      ]
    },
    {
      market: 'UK',
      language: 'en',
      totalKeywords: 89000,
      avgCPC: 1.20,
      topKeyword: 'best iptv uk 2026',
      topKeywordVol: 450000,
      competitorCount: 420,
      difficulty: 'LOW',
      opportunity: 'HOT',
      expiredAvailable: 1240,
      successRate: 74,
      avgDaysToRank: 5,
      estimatedRPM: 16,
      topTLDs: ['.co.uk', '.com', '.tv', '.net'],
      topKeywords: [
        { keyword: 'best iptv uk 2026', volume: 450000, cpc: 1.20, difficulty: 24 },
        { keyword: 'iptv subscription uk', volume: 368000, cpc: 1.10, difficulty: 22 },
        { keyword: 'best iptv for premier league', volume: 550000, cpc: 2.40, difficulty: 32 },
        { keyword: 'cheap iptv uk', volume: 301000, cpc: 1.20, difficulty: 25 },
        { keyword: 'sky sports iptv alternative', volume: 368000, cpc: 1.80, difficulty: 30 }
      ]
    },
    {
      market: 'FR',
      language: 'fr',
      totalKeywords: 124000,
      avgCPC: 0.85,
      topKeyword: 'meilleur iptv 2026',
      topKeywordVol: 550000,
      competitorCount: 124,
      difficulty: 'LOW',
      opportunity: 'HOT',
      expiredAvailable: 2840,
      successRate: 82,
      avgDaysToRank: 4,
      estimatedRPM: 14,
      topTLDs: ['.fr', '.com', '.tv'],
      topKeywords: [
        { keyword: 'meilleur iptv 2026', volume: 550000, cpc: 0.90, difficulty: 20 },
        { keyword: 'abonnement iptv france', volume: 450000, cpc: 0.80, difficulty: 18 },
        { keyword: 'iptv ligue 1', volume: 450000, cpc: 1.20, difficulty: 24 },
        { keyword: 'iptv gratuit france', volume: 673000, cpc: 0.40, difficulty: 14 },
        { keyword: 'meilleure application iptv', volume: 301000, cpc: 0.85, difficulty: 19 }
      ]
    },
    {
      market: 'DE',
      language: 'de',
      totalKeywords: 89000,
      avgCPC: 0.88,
      topKeyword: 'bestes iptv 2026',
      topKeywordVol: 368000,
      competitorCount: 98,
      difficulty: 'LOW',
      opportunity: 'HOT',
      expiredAvailable: 1840,
      successRate: 79,
      avgDaysToRank: 5,
      estimatedRPM: 15,
      topTLDs: ['.de', '.com', '.tv'],
      topKeywords: [
        { keyword: 'bestes iptv 2026', volume: 368000, cpc: 0.85, difficulty: 18 },
        { keyword: 'iptv anbieter deutschland', volume: 301000, cpc: 0.90, difficulty: 20 },
        { keyword: 'iptv bundesliga', volume: 450000, cpc: 1.40, difficulty: 26 },
        { keyword: 'iptv kostenlos', volume: 550000, cpc: 0.35, difficulty: 14 },
        { keyword: 'iptv gratis testen', volume: 201000, cpc: 0.95, difficulty: 19 }
      ]
    },
    {
      market: 'NL',
      language: 'nl',
      totalKeywords: 42000,
      avgCPC: 0.82,
      topKeyword: 'beste iptv 2026',
      topKeywordVol: 201000,
      competitorCount: 48,
      difficulty: 'VERY LOW',
      opportunity: 'HOT',
      expiredAvailable: 1420,
      successRate: 84,
      avgDaysToRank: 4,
      estimatedRPM: 13,
      topTLDs: ['.nl', '.com', '.be', '.tv'],
      topKeywords: [
        { keyword: 'beste iptv 2026', volume: 201000, cpc: 0.80, difficulty: 14 },
        { keyword: 'iptv abonnement nederland', volume: 168000, cpc: 0.85, difficulty: 16 },
        { keyword: 'iptv eredivisie', volume: 201000, cpc: 1.20, difficulty: 20 },
        { keyword: 'iptv nederland gratis', volume: 246000, cpc: 0.35, difficulty: 12 },
        { keyword: 'goedkope iptv', volume: 168000, cpc: 0.75, difficulty: 15 }
      ]
    },
    {
      market: 'SE',
      language: 'sv',
      totalKeywords: 28000,
      avgCPC: 0.76,
      topKeyword: 'bästa iptv 2026',
      topKeywordVol: 135000,
      competitorCount: 28,
      difficulty: 'VERY LOW',
      opportunity: 'HOT',
      expiredAvailable: 980,
      successRate: 86,
      avgDaysToRank: 3,
      estimatedRPM: 12,
      topTLDs: ['.se', '.com', '.nu', '.tv'],
      topKeywords: [
        { keyword: 'bästa iptv 2026', volume: 135000, cpc: 0.75, difficulty: 12 },
        { keyword: 'iptv prenumeration sverige', volume: 90500, cpc: 0.80, difficulty: 13 },
        { keyword: 'iptv allsvenskan', volume: 135000, cpc: 1.10, difficulty: 18 },
        { keyword: 'billig iptv', volume: 90500, cpc: 0.70, difficulty: 13 },
        { keyword: 'bästa iptv app', volume: 90500, cpc: 0.65, difficulty: 12 }
      ]
    },
    {
      market: 'NO',
      language: 'no',
      totalKeywords: 22000,
      avgCPC: 0.82,
      topKeyword: 'beste iptv 2026',
      topKeywordVol: 90500,
      competitorCount: 18,
      difficulty: 'VERY LOW',
      opportunity: 'HOT',
      expiredAvailable: 840,
      successRate: 88,
      avgDaysToRank: 3,
      estimatedRPM: 13,
      topTLDs: ['.no', '.com', '.tv'],
      topKeywords: [
        { keyword: 'beste iptv 2026', volume: 90500, cpc: 0.80, difficulty: 11 },
        { keyword: 'iptv abonnement norge', volume: 74000, cpc: 0.85, difficulty: 12 },
        { keyword: 'iptv eliteserien', volume: 90500, cpc: 1.10, difficulty: 16 },
        { keyword: 'billig iptv norge', volume: 60500, cpc: 0.75, difficulty: 12 },
        { keyword: 'beste iptv app android', volume: 60500, cpc: 0.65, difficulty: 11 }
      ]
    },
    {
      market: 'DK',
      language: 'da',
      totalKeywords: 18000,
      avgCPC: 0.76,
      topKeyword: 'bedste iptv 2026',
      topKeywordVol: 74000,
      competitorCount: 14,
      difficulty: 'VERY LOW',
      opportunity: 'HOT',
      expiredAvailable: 720,
      successRate: 89,
      avgDaysToRank: 3,
      estimatedRPM: 12,
      topTLDs: ['.dk', '.com', '.tv'],
      topKeywords: [
        { keyword: 'bedste iptv 2026', volume: 74000, cpc: 0.75, difficulty: 10 },
        { keyword: 'iptv abonnement danmark', volume: 60500, cpc: 0.80, difficulty: 11 },
        { keyword: 'iptv superliga', volume: 90500, cpc: 1.10, difficulty: 15 },
        { keyword: 'billig iptv denmark', volume: 60500, cpc: 0.70, difficulty: 11 },
        { keyword: 'bedste iptv app', volume: 60500, cpc: 0.65, difficulty: 10 }
      ]
    }
  ]

  for (const market of IPTV_MARKET_DATA) {
    console.log(`Seeding market analysis for ${market.market}...`)
    await prisma.iPTVMarketAnalysis.upsert({
      where: { market: market.market },
      update: market,
      create: market
    })
  }

  console.log('Seeding complete!')
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
