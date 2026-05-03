export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { prisma } from "@/lib/prisma"

export async function GET(request: Request) {
  const log: string[] = []
  
  try {
    // Load niches
    let niches = []
    try {
      niches = await prisma.niche.findMany({ where: { active: true } })
      log.push(`Loaded ${niches.length} niches`)
    } catch (e) {
      log.push(`Niche load failed: ${String(e)}`)
      // Continue with empty niches
    }

    const allKeywords = niches.flatMap(n => n.keywords || [])
    log.push(`Keywords: ${allKeywords.length}`)

    // Try ExpiredDomains only (most compatible)
    let domains: string[] = []
    
    try {
      const response = await fetch(
        `https://www.expireddomains.net/domain-search/?q=iptv&ftlds[]=com&ftlds[]=fr&ftlds[]=de`,
        {
          headers: { 
            'User-Agent': 'Mozilla/5.0',
            'Accept': 'text/html'
          },
          signal: AbortSignal.timeout(10000)
        }
      )
      log.push(`ExpiredDomains status: ${response.status}`)
      
      if (response.ok) {
        const html = await response.text()
        const matches = html.match(/class="field_domain"[^>]*>\s*<a[^>]*>([^<]+)<\/a>/gi) || []
        domains = matches.slice(0, 20).map((m: string) => {
          const match = m.match(/>([^<]+)<\/a>/)
          return match ? match[1].trim() : ''
        }).filter(Boolean)
        log.push(`Found ${domains.length} domains`)
      }
    } catch (e) {
      log.push(`Fetch failed: ${String(e)}`)
    }

    // Save any found domains
    let saved = 0
    for (const domain of domains.slice(0, 10)) {
      try {
        await prisma.domain.upsert({
          where: { name: domain },
          update: {},
          create: {
            name: domain,
            status: 'PENDING',
            source: 'expireddomains',
            niche: 'unknown',
            score: 0
          }
        })
        saved++
      } catch (e) {
        log.push(`Save failed for ${domain}: ${String(e)}`)
      }
    }

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
