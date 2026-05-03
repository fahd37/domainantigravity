/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { updateAllMarkets } from '@/lib/iptv/keyword-updater'

export async function GET(request: NextRequest) {
  // Verify cron secret
  if (request.headers.get('x-cron-secret') !== process.env.CRON_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Load DataForSEO credentials from settings
    const settings = await prisma.settings.findMany()
    const getVal = (key: string) => settings.find(s => s.key === key)?.value || ''

    const email = getVal('dataForSeoEmail')
    const password = getVal('dataForSeoPassword')

    if (!email || !password) {
      return Response.json({
        success: false,
        error: 'DataForSEO not configured in settings'
      }, { status: 400 })
    }

    console.log('Starting weekly IPTV market keyword update...')
    const results = await updateAllMarkets(email, password)

    // Log to ScanRun
    await prisma.scanRun.create({
      data: {
        startedAt: new Date(Date.now() - results.elapsedSeconds * 1000),
        endedAt: new Date(),
        source: 'keyword-updater',
        domainsScanned: 0,
        domainsPassed: 0,
        domainsBought: 0,
        totalSpent: 0,
        status: results.success ? 'COMPLETED' : 'PARTIAL',
        log: results.results as any
      }
    })

    return Response.json({
      success: true,
      message: `Updated ${results.marketsUpdated}/${results.marketsTotal} markets`,
      elapsedSeconds: results.elapsedSeconds,
      nextUpdate: results.nextUpdate,
      details: results.results.map((r: any) => ({
        market: r.market,
        success: r.success,
        topKeyword: r.topKeyword,
        topKeywordVolume: r.topKeywordVolume,
        avgCPC: r.avgCPC
      }))
    })

  } catch (error) {
    return Response.json({ success: false, error: String(error) }, { status: 500 })
  }
}
