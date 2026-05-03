export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { prisma } from '@/lib/prisma'

export async function GET() {
  let saved = 0
  const log: string[] = []

  try {
    // Use Namecheap API (already configured in settings)
    const settings = await prisma.settings.findMany()
    const getVal = (key: string) => settings.find(s => s.key === key)?.value || ''
    
    const apiUser = getVal('namecheapApiUser')
    const apiKey = getVal('namecheapApiKey')
    const sandboxMode = getVal('namecheapSandbox') === 'true'

    // Keywords to search
    const keywords = ['iptv', 'stream', 'streaming', 'livetv', 
      'seo', 'marketing', 'ai', 'health', 'finance']

    if (!apiKey || !apiUser) {
      log.push('Namecheap not configured — using GoDaddy RSS feed')
      
      // GoDaddy expiring domains RSS — works without auth
      for (const keyword of keywords.slice(0, 5)) {
        try {
          const url = `https://auctions.godaddy.com/trpSearch.aspx?q=${keyword}&searchType=phrase&status=2&rss=1`
          const res = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            signal: AbortSignal.timeout(8000)
          })
          
          if (!res.ok) {
            log.push(`GoDaddy ${keyword}: ${res.status}`)
            continue
          }
          
          const xml = await res.text()
          const titles = xml.match(/<title>([^<]+\.[a-z]{2,})<\/title>/gi) || []
          
          for (const title of titles.slice(0, 10)) {
            const domain = title.replace(/<\/?title>/gi, '').trim().toLowerCase()
            if (!domain.includes('.') || domain.includes('godaddy')) continue
            
            try {
              await prisma.domain.upsert({
                where: { name: domain },
                update: {},
                create: {
                  name: domain,
                  tld: '.' + domain.split('.').pop(),
                  status: 'PENDING',
                  source: 'godaddy-rss',
                  niche: 'unknown',
                  score: 0
                }
              })
              saved++
            } catch {}
          }
          
          log.push(`GoDaddy ${keyword}: ${titles.length} found, total saved: ${saved}`)
          await new Promise(r => setTimeout(r, 1000))
          
        } catch (e) {
          log.push(`GoDaddy ${keyword} error: ${String(e).slice(0, 80)}`)
        }
      }
    } else {
      // Use Namecheap marketplace API
      log.push('Using Namecheap API')
      const base = sandboxMode 
        ? 'https://api.sandbox.namecheap.com' 
        : 'https://api.namecheap.com'
      
      for (const keyword of keywords.slice(0, 5)) {
        try {
          const url = `${base}/xml.response?ApiUser=${apiUser}&ApiKey=${apiKey}&UserName=${apiUser}&Command=namecheap.domains.check&ClientIp=1.1.1.1&DomainList=${keyword}.com,${keyword}.net,${keyword}.io,${keyword}.de,${keyword}.fr`
          
          const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
          const xml = await res.text()
          
          const available = xml.match(/Domain="([^"]+)" Available="true"/gi) || []
          
          for (const match of available) {
            const domainMatch = match.match(/Domain="([^"]+)"/)
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
                  source: 'namecheap-api',
                  niche: 'unknown',
                  score: 0
                }
              })
              saved++
            } catch {}
          }
          log.push(`${keyword}: ${available.length} available`)
        } catch (e) {
          log.push(`${keyword}: ${String(e).slice(0, 50)}`)
        }
      }
    }

    // Always save scan run
    await prisma.scanRun.create({
      data: {
        startedAt: new Date(),
        endedAt: new Date(),
        source: 'auto-scan',
        domainsScanned: saved,
        domainsPassed: saved,
        domainsBought: 0,
        totalSpent: 0,
        status: 'COMPLETED',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        log: log as any
      }
    }).catch(() => {})

    return Response.json({ success: true, domainsFound: saved, domainsSaved: saved, log })

  } catch (error) {
    return Response.json({ success: false, error: String(error), log }, { status: 500 })
  }
}
