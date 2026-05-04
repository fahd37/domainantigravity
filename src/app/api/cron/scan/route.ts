export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { prisma } from '@/lib/prisma'
import { downloadWhoisDSDrops } from '@/lib/sources/whoisds'

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
    
    log.push(`Searching with ${fallbackKeywords.length} keywords: ${fallbackKeywords.slice(0, 5).join(', ')}`)
    console.log('SCAN: Starting with keywords:', fallbackKeywords)
    
    const domains = await downloadWhoisDSDrops(fallbackKeywords)
    log.push(`WhoisDS/sources returned: ${domains.length} domains`)
    console.log('SCAN LOG:', log)

    for (const d of domains) {
      try {
        const exists = await prisma.domain.findFirst({ where: { name: d.domain } })
        if (exists) continue
        await prisma.domain.create({
          data: {
            name: d.domain,
            tld: '.' + d.domain.split('.').pop(),
            status: 'PENDING',
            source: d.source || 'expired-scan',
            niche: 'unknown',
            score: 0
          }
        })
        saved++
      } catch {}
    }

    log.push(`Saved ${saved} new domains`)
    console.log('SCAN COMPLETE:', { domainsFound: domains.length, saved })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    console.error('SCAN FATAL:', error)
    return Response.json({
      success: false,
      error: String(error),
      log
    }, { status: 500 })
  }
}
