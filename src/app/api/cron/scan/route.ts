export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { prisma } from '@/lib/prisma'
import { fetchExpiredDomains } from '@/lib/sources/whoisds'

export async function GET() {
  let saved = 0
  const log: string[] = []

  try {
    const niches = await prisma.niche.findMany({ where: { active: true } })
    const keywords = niches.flatMap(n => n.keywords || [])
    
    const fallbackKeywords = keywords.length > 0 ? keywords : [
      'iptv', 'streaming', 'stream', 'livetv',
      'ai', 'seo', 'marketing', 'health', 'finance'
    ]
    
    log.push(`Searching with ${fallbackKeywords.length} keywords`)
    
    const domains = await fetchExpiredDomains(fallbackKeywords)
    log.push(`Found ${domains.length} matching domains`)

    for (const domain of domains) {
      try {
        const exists = await prisma.domain.findFirst({ where: { name: domain } })
        if (exists) continue
        await prisma.domain.create({
          data: {
            name: domain,
            status: 'PENDING',
            source: 'expired-scan',
            niche: 'unknown',
            score: 0
          }
        })
        saved++
      } catch {}
    }

    log.push(`Saved ${saved} new domains`)

    await prisma.scanRun.create({
      data: {
        startedAt: new Date(),
        endedAt: new Date(),
        source: 'whoisds+expired',
        domainsScanned: domains.length,
        domainsPassed: saved,
        domainsBought: 0,
        totalSpent: 0,
        status: 'COMPLETED',
        log: log as any
      }
    }).catch(() => {})

    return Response.json({
      success: true,
      domainsFound: domains.length,
      domainsSaved: saved,
      log
    })

  } catch (error) {
    return Response.json({
      success: false,
      error: String(error),
      log
    }, { status: 500 })
  }
}
