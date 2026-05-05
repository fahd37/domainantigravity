export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { prisma } from '@/lib/prisma'
import { downloadDailyDrops, filterByNicheKeywords } from '@/lib/pipeline/volume-engine'
import { verifyAvailability } from '@/lib/pipeline/verification-engine'
import { scoreDomains, DomainScore } from '@/lib/pipeline/authority-engine'
import { batchAnalyzeHistory } from '@/lib/pipeline/timemachine-engine'
import { batchCheckGoogleIndex } from '@/lib/pipeline/google-index-engine'

export async function GET() {
  const startTime = Date.now()
  const log: string[] = []
  let saved = 0

  try {
    // ═══════════════════════════════════════
    // LOAD CONFIGURATION
    // ═══════════════════════════════════════
    await prisma.niche.updateMany({ data: { active: true } })
    
    const settings = await prisma.settings.findMany()
    const getVal = (key: string) => settings.find(s => s.key === key)?.value || ''
    
    const whoisfreaksKey = getVal('whoisfreaksApiKey')
    const dataForSeoEmail = getVal('dataForSeoEmail')
    const dataForSeoPassword = getVal('dataForSeoPassword')
    const namecheapUser = getVal('namecheapApiUser')
    const namecheapKey = getVal('namecheapApiKey')
    
    if (!whoisfreaksKey) {
      return Response.json({ success: false, error: 'WhoisFreaks API key not configured', log })
    }
    
    const niches = await prisma.niche.findMany({ where: { active: true } })
    
    if (niches.length === 0) {
      return Response.json({ success: false, error: 'No active niches found', log })
    }

    console.log(`\n═══════════════════════════════════════`)
    console.log(`   AGGREGATED DROP-FEED PIPELINE`)
    console.log(`   ${niches.length} niches active`)
    console.log(`═══════════════════════════════════════\n`)

    // ═══════════════════════════════════════
    // ENGINE 1: VOLUME — Download daily drops
    // ═══════════════════════════════════════
    log.push(`ENGINE 1: Downloading daily drops from WhoisFreaks...`)
    const allDrops = await downloadDailyDrops(whoisfreaksKey)
    log.push(`Total drops downloaded: ${allDrops.length}`)
    
    if (allDrops.length === 0) {
      log.push('ERROR: WhoisFreaks returned 0 domains')
      return Response.json({ success: false, domainsFound: 0, domainsSaved: 0, log })
    }

    // ═══════════════════════════════════════
    // ENGINE 1b: FILTER — Match to niches by keyword
    // Cost: $0 — runs locally
    // ═══════════════════════════════════════
    log.push(`ENGINE 1b: Filtering ${allDrops.length} domains by niche keywords...`)
    const nicheData = niches.map(n => ({
      slug: n.slug,
      keywords: Array.isArray(n.keywords) ? n.keywords as string[] : 
        typeof n.keywords === 'string' ? (n.keywords as string).split(',').map(k => k.trim()) : [],
      tlds: Array.isArray(n.targetTlds) ? n.targetTlds as string[] : []
    }))
    
    const nicheMatches = filterByNicheKeywords(allDrops, nicheData)
    log.push(`Niche matches: ${nicheMatches.length} domains across ${new Set(nicheMatches.map(m => m.niche)).size} niches`)
    
    if (nicheMatches.length === 0) {
      log.push('No keyword matches found in today\'s drops')
      
      await prisma.scanRun.create({
        data: {
          startedAt: new Date(startTime), endedAt: new Date(),
          source: 'drop-feed-pipeline', domainsScanned: allDrops.length,
          domainsPassed: 0, domainsBought: 0, totalSpent: 0,
          status: 'NO_MATCHES', log: log as unknown as string[]
        }
      }).catch(() => {})
      
      return Response.json({ success: true, domainsFound: allDrops.length, nicheMatches: 0, domainsSaved: 0, log })
    }

    // ═══════════════════════════════════════
    // ENGINE 2: VERIFY — Check availability
    // Cost: FREE via Namecheap API
    // ═══════════════════════════════════════
    log.push(`ENGINE 2: Verifying availability of ${nicheMatches.length} domains...`)
    const available = await verifyAvailability(
      nicheMatches,
      namecheapUser || undefined,
      namecheapKey || undefined,
      whoisfreaksKey || undefined
    )
    log.push(`Available to register: ${available.length}`)

    // ═══════════════════════════════════════
    // ENGINE 3: AUTHORITY — Score with DataForSEO
    // Cost: $0.10 per domain scored
    // ═══════════════════════════════════════
    let scoredDomains: DomainScore[] = []
    
    if (dataForSeoEmail && dataForSeoPassword) {
      const toScore = available.filter(d => d.available).slice(0, 50)
      log.push(`ENGINE 3: Scoring ${toScore.length} available domains with DataForSEO...`)
      
      scoredDomains = await scoreDomains(
        toScore.map(d => ({ domain: d.domain, niche: d.niche, matchedKeyword: d.matchedKeyword })),
        dataForSeoEmail,
        dataForSeoPassword,
        50
      )
      log.push(`Scored: ${scoredDomains.length} domains`)
    } else {
      log.push('ENGINE 3: DataForSEO not configured — skipping scoring')
    }

    // ═══════════════════════════════════════
    // ENGINE 4: TIME MACHINE — Wayback verdict
    // Cost: FREE
    // ═══════════════════════════════════════
    const topCandidates = scoredDomains.length > 0 
      ? scoredDomains.filter(d => d.score >= 30).slice(0, 20)
      : available.filter(d => d.available).slice(0, 20)
    
    log.push(`ENGINE 4: Analyzing Wayback history for ${topCandidates.length} top candidates...`)
    
    const verdicts = await batchAnalyzeHistory(
      topCandidates.map(d => d.domain)
    )
    log.push(`Verdicts: ${Array.from(verdicts.values()).filter(v => v.verdict === 'CLEAN').length} clean, ${Array.from(verdicts.values()).filter(v => v.verdict === 'TOXIC').length} toxic`)

    // ═══════════════════════════════════════
    // ENGINE 5: GOOGLE INDEX — Check indexation
    // Cost: $0.002 per check via DataForSEO SERP
    // ═══════════════════════════════════════
    const cleanDomains = topCandidates.filter(d => {
      const verdict = verdicts.get(d.domain)
      return !verdict || verdict.verdict !== 'TOXIC'
    }).slice(0, 15)
    
    let indexResults = new Map<string, { indexed: boolean, pageCount: number }>()
    
    if (dataForSeoEmail && dataForSeoPassword && cleanDomains.length > 0) {
      log.push(`ENGINE 5: Checking Google index for ${cleanDomains.length} clean domains...`)
      indexResults = await batchCheckGoogleIndex(
        cleanDomains.map(d => d.domain),
        dataForSeoEmail,
        dataForSeoPassword
      )
      const indexedCount = Array.from(indexResults.values()).filter(r => r.indexed).length
      log.push(`Google indexed: ${indexedCount} out of ${cleanDomains.length}`)
    }

    // ═══════════════════════════════════════
    // SAVE TO DATABASE
    // ═══════════════════════════════════════
    log.push(`Saving results to database...`)
    
    // Save all niche matches (even unscored) for manual review
    for (const match of nicheMatches.slice(0, 500)) {
      try {
        const scored = scoredDomains.find(s => s.domain === match.domain)
        const verdict = verdicts.get(match.domain)
        const indexInfo = indexResults.get(match.domain)
        
        let finalScore = scored?.score || 0
        
        // Bonus for Google indexed
        if (indexInfo?.indexed) finalScore += 15
        
        // Penalty for toxic
        if (verdict?.verdict === 'TOXIC') finalScore = 0
        
        // Bonus for clean history with many snapshots
        if (verdict?.verdict === 'CLEAN' && verdict.snapshotCount > 20) finalScore += 10
        
        const status = verdict?.verdict === 'TOXIC' ? 'REJECTED'
          : finalScore >= 60 ? 'QUEUED'
          : 'PENDING'
        
        await prisma.domain.upsert({
          where: { name: match.domain },
          update: {
            score: finalScore,
            status,
          },
          create: {
            name: match.domain,
            tld: '.' + match.domain.split('.').slice(1).join('.'),
            status,
            source: 'drop-feed-pipeline',
            niche: match.niche,
            score: finalScore,
            referringDomains: scored?.referringDomains || 0,
            domainAge: scored?.age || 0,
            googleIndexed: indexInfo?.indexed || null,
            googlePageCount: indexInfo?.pageCount || null,
          }
        })
        saved++
        
      } catch {
        // Skip save errors silently
      }
    }

    // ═══════════════════════════════════════
    // FINAL REPORT
    // ═══════════════════════════════════════
    const elapsed = Math.round((Date.now() - startTime) / 1000)
    const queued = nicheMatches.filter(m => {
      const s = scoredDomains.find(sd => sd.domain === m.domain)
      return s && s.score >= 60
    }).length
    
    log.push(``)
    log.push(`═══════════════════════════════════════`)
    log.push(`   PIPELINE COMPLETE — ${elapsed}s`)
    log.push(`═══════════════════════════════════════`)
    log.push(`   Total drops:      ${allDrops.length}`)
    log.push(`   Niche matches:    ${nicheMatches.length}`)
    log.push(`   Available:        ${available.filter(a => a.available).length}`)
    log.push(`   Scored:           ${scoredDomains.length}`)
    log.push(`   Clean history:    ${Array.from(verdicts.values()).filter(v => v.verdict === 'CLEAN').length}`)
    log.push(`   Google indexed:   ${Array.from(indexResults.values()).filter(r => r.indexed).length}`)
    log.push(`   Queued (≥60):     ${queued}`)
    log.push(`   Saved to DB:      ${saved}`)
    log.push(`═══════════════════════════════════════`)
    
    // Top finds
    const topFinds = scoredDomains.slice(0, 5)
    if (topFinds.length > 0) {
      log.push(``)
      log.push(`🏆 TOP FINDS:`)
      for (const d of topFinds) {
        const v = verdicts.get(d.domain)
        const idx = indexResults.get(d.domain)
        log.push(`   ${d.domain} — Score: ${d.score} | Traffic: $${d.traffic} | Refs: ${d.referringDomains} | ${v?.verdict || '?'} | ${idx?.indexed ? 'INDEXED ✅' : 'not indexed'}`)
      }
    }
    
    console.log(log.slice(-15).join('\n'))
    
    // Save scan run
    await prisma.scanRun.create({
      data: {
        startedAt: new Date(startTime), endedAt: new Date(),
        source: 'drop-feed-pipeline',
        domainsScanned: allDrops.length,
        domainsPassed: saved,
        domainsBought: 0, totalSpent: 0,
        status: 'COMPLETED',
        log: log as unknown as string[]
      }
    }).catch(() => {})

    return Response.json({
      success: true,
      totalDrops: allDrops.length,
      nicheMatches: nicheMatches.length,
      available: available.filter(a => a.available).length,
      scored: scoredDomains.length,
      cleanHistory: Array.from(verdicts.values()).filter(v => v.verdict === 'CLEAN').length,
      googleIndexed: Array.from(indexResults.values()).filter(r => r.indexed).length,
      queued,
      domainsSaved: saved,
      elapsed: `${elapsed}s`,
      topFinds: scoredDomains.slice(0, 10).map(d => ({
        domain: d.domain,
        score: d.score,
        niche: d.niche,
        traffic: d.traffic,
        keywords: d.keywords,
        refs: d.referringDomains,
        age: d.age,
        verdict: verdicts.get(d.domain)?.verdict || 'unchecked',
        indexed: indexResults.get(d.domain)?.indexed || false,
        pageCount: indexResults.get(d.domain)?.pageCount || 0
      })),
      log
    })

  } catch (error) {
    log.push(`FATAL: ${String(error)}`)
    console.error('[PIPELINE] FATAL ERROR:', error)
    
    await prisma.scanRun.create({
      data: {
        startedAt: new Date(startTime), endedAt: new Date(),
        source: 'drop-feed-pipeline', domainsScanned: 0,
        domainsPassed: 0, domainsBought: 0, totalSpent: 0,
        status: 'ERROR', log: log as unknown as string[]
      }
    }).catch(() => {})
    
    return Response.json({ success: false, error: String(error), log }, { status: 500 })
  }
}
