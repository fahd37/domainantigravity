export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

import { prisma } from '@/lib/prisma'

export async function GET() {
  let saved = 0
  const log: string[] = []

  try {
    // Use hardcoded keywords — don't wait for DB
    const keywords = [
      'iptv', 'streaming', 'stream', 'livetv',
      'meilleur-iptv', 'bestes-iptv', 'beste-iptv',
      'firestick', 'kodi', 'seo', 'marketing',
      'ai', 'finance', 'health', 'saas'
    ]

    log.push(`Using ${keywords.length} keywords`)

    // Namecheap — most reliable on Netlify
    for (const keyword of keywords.slice(0, 5)) {
      try {
        const url = `https://www.namecheap.com/domains/marketplace/buy/?q=${encodeURIComponent(keyword)}`
        const res = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          signal: AbortSignal.timeout(5000)
        })
        
        if (!res.ok) continue
        
        const html = await res.text()
        const regex = /data-domain="([a-z0-9][a-z0-9\-.]{1,61}[a-z0-9])"/gi
        let match
        
        while ((match = regex.exec(html)) !== null) {
          const domain = match[1].toLowerCase()
          if (!domain || domain.length < 4) continue
          
          // SAVE IMMEDIATELY
          try {
            await prisma.domain.upsert({
              where: { name: domain },
              update: {},
              create: {
                name: domain,
                tld: '.' + domain.split('.').pop(),
                status: 'PENDING',
                source: 'namecheap-market',
                niche: 'unknown',
                score: 0
              }
            })
            saved++
          } catch {}
        }
        
        log.push(`${keyword}: saved ${saved} so far`)
        
      } catch (e) {
        log.push(`${keyword} failed: ${String(e).slice(0, 50)}`)
      }
    }

    // Also try ExpiredDomains
    try {
      const res = await fetch(
        'https://www.expireddomains.net/domain-search/?q=iptv&ftlds[]=com&ftlds[]=fr',
        {
          headers: { 
            'User-Agent': 'Mozilla/5.0',
            'Referer': 'https://www.expireddomains.net'
          },
          signal: AbortSignal.timeout(6000)
        }
      )
      
      if (res.ok) {
        const html = await res.text()
        const rows = html.match(/<td class="field_domain"[^>]*>.*?<\/td>/gs) || []
        
        for (const row of rows.slice(0, 20)) {
          const domainMatch = row.match(/>([a-z0-9][a-z0-9.-]+\.[a-z]{2,})</)
          if (!domainMatch) continue
          const domain = domainMatch[1].toLowerCase()
          
          try {
            await prisma.domain.upsert({
              where: { name: domain },
              update: {},
              create: {
                name: domain,
                tld: '.' + domain.split('.').pop(),
                status: 'PENDING', 
                source: 'expireddomains',
                niche: 'unknown',
                score: 0
              }
            })
            saved++
          } catch {}
        }
        log.push(`ExpiredDomains: ${rows.length} rows found`)
      }
    } catch (e) {
      log.push(`ExpiredDomains failed: ${String(e).slice(0, 50)}`)
    }

    // Log scan run
    try {
      await prisma.scanRun.create({
        data: {
          startedAt: new Date(),
          endedAt: new Date(),
          source: 'namecheap+expired',
          domainsScanned: saved,
          domainsPassed: saved,
          domainsBought: 0,
          totalSpent: 0,
          status: 'COMPLETED',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          log: log as any
        }
      })
    } catch {}

    return Response.json({
      success: true,
      domainsFound: saved,
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
