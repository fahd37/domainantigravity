/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { prisma } from '@/lib/prisma'
import { getMarketConfig } from './market-config'
import { IPTV_KEYWORD_DATABASE } from './keyword-database'

export async function updateMarketKeywords(
  market: string,
  dataForSeoEmail: string,
  dataForSeoPassword: string
) {
  const config = getMarketConfig(market)
  const log: string[] = []

  try {
    // Get keywords for this market from database
    const marketKey = `${config.languageCode}_${market}`
    const marketData = (IPTV_KEYWORD_DATABASE as any)[marketKey] || (IPTV_KEYWORD_DATABASE as any)[`${config.languageCode}_${market.toLowerCase()}`] || (IPTV_KEYWORD_DATABASE as any)[`${market.toLowerCase()}`]
    
    // Fallback logic to get it from object structure if exact key match fails. The db is somewhat dynamic
    let selectedData = marketData;
    if (!selectedData) {
      for (const key of Object.keys(IPTV_KEYWORD_DATABASE)) {
        if ((IPTV_KEYWORD_DATABASE as any)[key].market === market) {
          selectedData = (IPTV_KEYWORD_DATABASE as any)[key];
          break;
        }
      }
    }

    if (!selectedData) {
      log.push(`No keyword database found for market: ${market}`)
      return { success: false, log }
    }

    const keywords = selectedData.keywords.map((k: any) => k.keyword)
    log.push(`Fetching volumes for ${keywords.length} keywords in ${market} market`)

    // DataForSEO API call — search volume
    const response = await fetch(
      'https://api.dataforseo.com/v3/keywords_data/google_ads/search_volume/live',
      {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + Buffer.from(`${dataForSeoEmail}:${dataForSeoPassword}`).toString('base64'),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify([{
          keywords: keywords.slice(0, 700), // DataForSEO limit per request
          language_code: config.languageCode,
          location_code: config.locationCode,
          date_from: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        }]),
        signal: AbortSignal.timeout(30000)
      }
    )

    if (!response.ok) {
      log.push(`DataForSEO API error: ${response.status}`)
      return { success: false, log }
    }

    const data = await response.json()

    if (data.tasks?.[0]?.status_code !== 20000) {
      log.push(`DataForSEO task error: ${data.tasks?.[0]?.status_message}`)
      return { success: false, log }
    }

    const results = data.tasks[0].result || []
    log.push(`Got ${results.length} keyword results from DataForSEO`)

    // Process results
    const updatedKeywords = results
      .filter((item: any) => item.search_volume > 0)
      .map((item: any) => ({
        keyword: item.keyword,
        volume: item.search_volume || 0,
        cpc: item.cpc || 0,
        competition: item.competition || 0,
        competitionLevel: item.competition_level || 'LOW',
        trend: detectTrend(item.monthly_searches || []),
        monthlyData: item.monthly_searches || []
      }))
      .sort((a: any, b: any) => b.volume - a.volume)

    if (updatedKeywords.length === 0) {
      log.push('No keyword data returned — keeping existing data')
      return { success: false, log }
    }

    // Calculate market metrics from real data
    const topKeyword = updatedKeywords[0]
    const totalSearches = updatedKeywords.reduce((sum: number, k: any) => sum + k.volume, 0)
    const avgCPC = updatedKeywords.reduce((sum: number, k: any) => sum + k.cpc, 0) / updatedKeywords.length
    const moneyKeywords = updatedKeywords.filter((k: any) => k.cpc > 0.5 && k.volume > 10000)

    // Detect trending keywords (volume up >20% vs 3 months ago)
    const trendingKeywords = updatedKeywords.filter((k: any) => k.trend === 'UP').slice(0, 3)

    // Update IPTVMarketAnalysis in DB
    await prisma.iPTVMarketAnalysis.upsert({
      where: { market },
      update: {
        topKeyword: topKeyword.keyword,
        topKeywordVol: topKeyword.volume,
        avgCPC: parseFloat(avgCPC.toFixed(2)),
        totalKeywords: updatedKeywords.length,
        topKeywords: updatedKeywords.slice(0, 10) as any,
        lastUpdated: new Date(),
        dataSource: 'dataforseo-live'
      },
      create: {
        market,
        language: config.languageCode,
        topKeyword: topKeyword.keyword,
        topKeywordVol: topKeyword.volume,
        avgCPC: parseFloat(avgCPC.toFixed(2)),
        totalKeywords: updatedKeywords.length,
        topKeywords: updatedKeywords.slice(0, 10) as any,
        competitorCount: 0,
        difficulty: 'MEDIUM',
        opportunity: 'HOT',
        expiredAvailable: 0,
        successRate: 75,
        avgDaysToRank: 7,
        estimatedRPM: 15,
        topTLDs: selectedData.topTLDs,
        dataSource: 'dataforseo-live',
        lastUpdated: new Date()
      }
    })

    // Update individual keywords in NicheKeyword table
    for (const kw of updatedKeywords) {
      await prisma.nicheKeyword.upsert({
        where: { 
          keyword_market: { keyword: kw.keyword, market }
        },
        update: {
          searchVolume: kw.volume,
          cpc: kw.cpc,
          difficulty: Math.round(kw.competition * 100),
          trend: kw.trend
        },
        create: {
          nicheSlug: 'iptv',
          keyword: kw.keyword,
          language: config.languageCode,
          market,
          searchVolume: kw.volume,
          cpc: kw.cpc,
          difficulty: Math.round(kw.competition * 100),
          trend: kw.trend,
          parasiteReady: kw.volume > 10000 && kw.cpc > 0.3
        }
      })
    }

    log.push(`✅ Updated ${market} market: top keyword "${topKeyword.keyword}" (${topKeyword.volume.toLocaleString()} searches), avg CPC ${config.currencySymbol}${avgCPC.toFixed(2)}`)
    log.push(`Trending keywords: ${trendingKeywords.map((k: any) => k.keyword).join(', ') || 'none'}`)

    return {
      success: true,
      market,
      topKeyword: topKeyword.keyword,
      topKeywordVolume: topKeyword.volume,
      avgCPC,
      totalKeywords: updatedKeywords.length,
      trendingKeywords,
      moneyKeywords: moneyKeywords.length,
      log
    }

  } catch (error) {
    log.push(`Error updating ${market}: ${error}`)
    return { success: false, error: String(error), log }
  }
}

function detectTrend(monthlySearches: Array<{ year: number, month: number, search_volume: number }>): string {
  if (!monthlySearches || monthlySearches.length < 3) return 'STABLE'
  
  const sorted = monthlySearches.sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year
    return a.month - b.month
  })
  
  const recent3 = sorted.slice(-3).reduce((sum, m) => sum + m.search_volume, 0) / 3
  const prev3 = sorted.slice(-6, -3).reduce((sum, m) => sum + m.search_volume, 0) / 3
  
  if (prev3 === 0) return 'STABLE'
  
  const change = (recent3 - prev3) / prev3
  
  if (change > 0.20) return 'UP'
  if (change < -0.15) return 'DOWN'
  return 'STABLE'
}

export async function updateAllMarkets(
  dataForSeoEmail: string,
  dataForSeoPassword: string,
  markets: string[] = ['US', 'UK', 'FR', 'DE', 'NL', 'SE', 'NO', 'DK']
) {
  const results = []
  const startTime = Date.now()

  for (const market of markets) {
    console.log(`Updating ${market} market keywords...`)
    
    // 2 second delay between markets
    // to respect DataForSEO rate limits
    if (results.length > 0) {
      await new Promise(r => setTimeout(r, 2000))
    }

    const result = await updateMarketKeywords(market, dataForSeoEmail, dataForSeoPassword)
    results.push(result)

    console.log(`${market}: ${result.success ? '✅' : '❌'} ${result.log?.slice(-1)[0]}`)
  }

  const successful = results.filter(r => r.success).length
  const elapsed = Math.round((Date.now() - startTime) / 1000)

  return {
    success: successful === markets.length,
    marketsUpdated: successful,
    marketsTotal: markets.length,
    elapsedSeconds: elapsed,
    results,
    nextUpdate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  }
}
