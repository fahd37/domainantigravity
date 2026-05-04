export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { prisma } from '@/lib/prisma'
import { fetchDroppedDomains, filterByKeywords } from '@/lib/sources/whoisfreaks'
import { scoreDomainsWithDataForSEO } from '@/lib/sources/dataforseo-domains'

export async function GET() {
  let saved = 0
  const log: string[] = []
  const startTime = Date.now()

  try {
    // Load settings
    const settings = await prisma.settings.findMany()
    const getVal = (key: string) => settings.find(s => s.key === key)?.value || ''
    
    const whoisfreaksKey = getVal('whoisfreaksApiKey') || '53598576e194490dbd84cab0afc953b1'
    // Support both key naming conventions
    const dataForSeoEmail = getVal('dataForSeoEmail') || getVal('dfs_email')
    const dataForSeoPassword = getVal('dataForSeoPassword') || getVal('dfs_password')
    
    // Auto-activate all niches so keyword pool is never empty
    await prisma.niche.updateMany({ data: { active: true } })
    
    // Load active niches + keywords
    const niches = await prisma.niche.findMany({ where: { active: true } })
    const keywords = niches.flatMap(n => n.keywords || [])
    const activeKeywords = keywords.length > 0 ? keywords : [
      'iptv', 'stream', 'streaming', 'livetv', 'tvbox',
      'ai', 'aitools', 'machinelearning', 'chatgpt',
      'seo', 'marketing', 'digitalmarketing',
      'health', 'wellness', 'fitness', 'nutrition',
      'finance', 'crypto', 'investing', 'trading',
      'saas', 'software', 'tools'
    ]
    
    log.push(`Step 1: Loading dropped domains from WhoisFreaks...`)
    log.push(`Using ${activeKeywords.length} keywords`)
    
    // STEP 1: WhoisFreaks — get today's dropped domains
    const allDomains = await fetchDroppedDomains(whoisfreaksKey)
    log.push(`WhoisFreaks returned: ${allDomains.length} total domains`)
    
    if (allDomains.length === 0) {
      log.push('WARNING: WhoisFreaks returned 0 domains — check API key or try later')
      
      await prisma.scanRun.create({
        data: {
          startedAt: new Date(startTime),
          endedAt: new Date(),
          source: 'whoisfreaks',
          domainsScanned: 0,
          domainsPassed: 0,
          domainsBought: 0,
          totalSpent: 0,
          status: 'EMPTY',
          log: log as any // eslint-disable-line @typescript-eslint/no-explicit-any
        }
      }).catch(() => {})
      
      return Response.json({ success: true, domainsFound: 0, domainsSaved: 0, log })
    }
    
    // STEP 2: Filter by niche keywords
    log.push(`Step 2: Filtering by ${activeKeywords.length} niche keywords...`)
    const nicheMatches = filterByKeywords(allDomains, activeKeywords)
    log.push(`Keyword matches: ${nicheMatches.length} domains`)
    
    if (nicheMatches.length === 0) {
      log.push("No keyword matches found in today's drops")
      
      await prisma.scanRun.create({
        data: {
          startedAt: new Date(startTime),
          endedAt: new Date(),
          source: 'whoisfreaks',
          domainsScanned: allDomains.length,
          domainsPassed: 0,
          domainsBought: 0,
          totalSpent: 0,
          status: 'NO_MATCHES',
          log: log as any // eslint-disable-line @typescript-eslint/no-explicit-any
        }
      }).catch(() => {})
      
      return Response.json({ 
        success: true, 
        domainsFound: allDomains.length, 
        nicheMatches: 0,
        domainsSaved: 0, 
        log 
      })
    }
    
    // STEP 3: Score top candidates with DataForSEO
    const candidateDomains = nicheMatches.slice(0, 200).map(m => m.domain)
    
    let scoredDomains = new Map()
    
    if (dataForSeoEmail && dataForSeoPassword) {
      log.push(`Step 3: Scoring ${candidateDomains.length} candidates with DataForSEO...`)
      scoredDomains = await scoreDomainsWithDataForSEO(candidateDomains, dataForSeoEmail, dataForSeoPassword)
      log.push(`DataForSEO scored: ${scoredDomains.size} domains`)
    } else {
      log.push('Step 3: DataForSEO not configured — saving all matches without scores')
    }
    
    // STEP 4: Save to database
    log.push(`Step 4: Saving domains to database...`)
    
    for (const match of nicheMatches) {
      try {
        const score = scoredDomains.get(match.domain)
        
        // Calculate basic quality score
        let qualityScore = 0
        if (score) {
          // Traffic score (max 40)
          qualityScore += Math.min(40, (score.organicTraffic / 100) * 10)
          // Keywords score (max 25)
          qualityScore += Math.min(25, score.organicKeywords * 0.5)
          // Backlinks score (max 20)
          qualityScore += Math.min(20, score.referringDomains * 0.5)
          // Age score (max 15)
          qualityScore += Math.min(15, score.ageYears * 2)
        }
        
        await prisma.domain.upsert({
          where: { name: match.domain },
          update: {
            score: Math.round(qualityScore),
            updatedAt: new Date()
          },
          create: {
            name: match.domain,
            status: qualityScore >= 60 ? 'QUEUED' : 'PENDING',
            source: 'whoisfreaks+dataforseo',
            niche: match.matchedKeyword,
            score: Math.round(qualityScore),
            referringDomains: score?.referringDomains || 0,
            domainAge: score?.ageYears || 0,
          }
        })
        saved++
        
      } catch {
        // Skip duplicates or errors silently
      }
    }
    
    log.push(`Saved: ${saved} domains to database`)
    
    const elapsed = Math.round((Date.now() - startTime) / 1000)
    log.push(`Scan completed in ${elapsed} seconds`)
    
    // Save scan run
    await prisma.scanRun.create({
      data: {
        startedAt: new Date(startTime),
        endedAt: new Date(),
        source: 'whoisfreaks+dataforseo',
        domainsScanned: allDomains.length,
        domainsPassed: saved,
        domainsBought: 0,
        totalSpent: 0,
        status: 'COMPLETED',
        log: log as any // eslint-disable-line @typescript-eslint/no-explicit-any
      }
    }).catch(() => {})
    
    return Response.json({
      success: true,
      domainsFound: allDomains.length,
      nicheMatches: nicheMatches.length,
      scored: scoredDomains.size,
      domainsSaved: saved,
      elapsed: `${elapsed}s`,
      log
    })
    
  } catch (error) {
    log.push(`FATAL ERROR: ${String(error)}`)
    console.error('Scan error:', error)
    
    return Response.json({
      success: false,
      error: String(error),
      log
    }, { status: 500 })
  }
}
