export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { prisma } from '@/lib/prisma'
import { searchDroppedDomains } from '@/lib/sources/whoisfreaks'

export async function GET() {
  let saved = 0
  const log: string[] = []
  const startTime = Date.now()

  try {
    // Auto-activate all niches
    await prisma.niche.updateMany({ data: { active: true } })
    
    // Load settings
    const settings = await prisma.settings.findMany()
    const getVal = (key: string) => settings.find(s => s.key === key)?.value || ''
    
    const whoisfreaksKey = getVal('whoisfreaksApiKey') || '53598576e194490dbd84cab0afc953b1'
    const dataForSeoEmail = getVal('dataForSeoEmail')
    const dataForSeoPassword = getVal('dataForSeoPassword')
    
    // Load keywords from active niches
    const niches = await prisma.niche.findMany({ where: { active: true } })
    const keywords = niches.flatMap(n => {
      const kws = n.keywords
      return Array.isArray(kws) ? kws : typeof kws === 'string' ? (kws as string).split(',').map((k: string) => k.trim()) : []
    }).filter((k: string) => k.length >= 2)
    
    const activeKeywords = keywords.length > 0 ? [...new Set(keywords)].slice(0, 25) : [
      'iptv', 'streaming', 'livetv', 'tvbox',
      'ai', 'aitools', 'machinelearning',
      'seo', 'marketing', 'digitalmarketing',
      'health', 'wellness', 'fitness',
      'finance', 'crypto', 'investing',
      'saas', 'software', 'tools'
    ]

    log.push(`Step 1: Searching WhoisFreaks with ${activeKeywords.length} keywords`)
    console.log('SCAN START:', activeKeywords)

    // STEP 1: WhoisFreaks — search dropped domains by keyword
    const droppedDomains = await searchDroppedDomains(activeKeywords, whoisfreaksKey)
    log.push(`WhoisFreaks found: ${droppedDomains.length} dropped domains`)
    console.log(`SCAN: WhoisFreaks returned ${droppedDomains.length} domains`)

    if (droppedDomains.length === 0) {
      log.push('No domains found — check API key and credits')
      
      await prisma.scanRun.create({
        data: {
          startedAt: new Date(startTime), endedAt: new Date(),
          source: 'whoisfreaks-search', domainsScanned: 0,
          domainsPassed: 0, domainsBought: 0, totalSpent: 0,
          status: 'EMPTY', log: log as any
        }
      }).catch(() => {})
      
      return Response.json({ success: true, domainsFound: 0, domainsSaved: 0, log })
    }

    // STEP 2: Score with DataForSEO (if configured)
    const candidates = droppedDomains.slice(0, 200)
    
    if (dataForSeoEmail && dataForSeoPassword) {
      log.push(`Step 2: Scoring ${candidates.length} domains with DataForSEO`)
      const auth = Buffer.from(`${dataForSeoEmail}:${dataForSeoPassword}`).toString('base64')
      
      for (const candidate of candidates) {
        try {
          const res = await fetch(
            'https://api.dataforseo.com/v3/domain_analytics/whois/overview/live',
            {
              method: 'POST',
              headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify([{
                limit: 1,
                filters: [["domain", "=", candidate.domain]]
              }]),
              signal: AbortSignal.timeout(10000)
            }
          )
          
          if (res.ok) {
            const data = await res.json()
            const item = data?.tasks?.[0]?.result?.[0]?.items?.[0]
            
            if (item) {
              let score = 0
              const traffic = item.metrics?.organic?.etv || 0
              const keywords = item.metrics?.organic?.count || 0
              const refs = item.backlinks_info?.referring_domains || 0
              const created = item.created_datetime
              const age = created ? Math.floor((Date.now() - new Date(created).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : 0
              
              score += Math.min(40, (traffic / 100) * 10)
              score += Math.min(25, keywords * 0.5)
              score += Math.min(20, refs * 0.5)
              score += Math.min(15, age * 2)
              
              await prisma.domain.upsert({
                where: { name: candidate.domain },
                update: { score: Math.round(score), updatedAt: new Date() },
                create: {
                  name: candidate.domain,
                  status: score >= 60 ? 'QUEUED' : 'PENDING',
                  source: 'whoisfreaks+dataforseo',
                  niche: candidate.matchedKeyword,
                  score: Math.round(score),
                  referringDomains: refs,
                  domainAge: age
                }
              })
              saved++
              
              if (score > 0) {
                console.log(`SCORED: ${candidate.domain} → ${Math.round(score)}pts (traffic=$${traffic}, kw=${keywords}, refs=${refs}, age=${age}yr)`)
              }
            }
          }
          
          await new Promise(r => setTimeout(r, 200))
          
        } catch (e) {
          // Save without score
          try {
            await prisma.domain.upsert({
              where: { name: candidate.domain },
              update: {},
              create: {
                name: candidate.domain,
                status: 'PENDING',
                source: 'whoisfreaks',
                niche: candidate.matchedKeyword,
                score: 0
              }
            })
            saved++
          } catch {}
        }
      }
    } else {
      // No DataForSEO — save all without scores
      log.push('Step 2: DataForSEO not configured — saving without scores')
      for (const candidate of candidates) {
        try {
          await prisma.domain.upsert({
            where: { name: candidate.domain },
            update: {},
            create: {
              name: candidate.domain,
              status: 'PENDING',
              source: 'whoisfreaks',
              niche: candidate.matchedKeyword,
              score: 0
            }
          })
          saved++
        } catch {}
      }
    }

    log.push(`Saved: ${saved} domains`)
    const elapsed = Math.round((Date.now() - startTime) / 1000)
    log.push(`Done in ${elapsed}s`)

    await prisma.scanRun.create({
      data: {
        startedAt: new Date(startTime), endedAt: new Date(),
        source: 'whoisfreaks+dataforseo', domainsScanned: droppedDomains.length,
        domainsPassed: saved, domainsBought: 0, totalSpent: 0,
        status: 'COMPLETED', log: log as any
      }
    }).catch(() => {})

    return Response.json({
      success: true,
      domainsFound: droppedDomains.length,
      domainsSaved: saved,
      elapsed: `${elapsed}s`,
      log
    })

  } catch (error) {
    log.push(`ERROR: ${String(error)}`)
    console.error('SCAN ERROR:', error)
    return Response.json({ success: false, error: String(error), log }, { status: 500 })
  }
}
