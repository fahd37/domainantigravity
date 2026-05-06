export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { prisma } from '@/lib/prisma'
import { downloadDailyDrops, filterByNicheKeywords } from '@/lib/pipeline/volume-engine'
import { verifyAvailability } from '@/lib/pipeline/verification-engine'
import { scoreDomains, DomainScore } from '@/lib/pipeline/authority-engine'
import { batchAnalyzeHistory } from '@/lib/pipeline/timemachine-engine'
import { batchCheckGoogleIndex } from '@/lib/pipeline/google-index-engine'

export async function POST(req: Request) {
  const startTime = Date.now()
  const log: string[] = []
  let saved = 0

  try {
    const body = await req.json()
    const nicheFilter = body.niche === 'all' ? null : body.niche || null

    // Load settings
    const settings = await prisma.settings.findMany()
    const getVal = (key: string) => settings.find(s => s.key === key)?.value || ''
    const whoisfreaksKey = getVal('whoisfreaksApiKey')
    const dataForSeoEmail = getVal('dataForSeoEmail')
    const dataForSeoPassword = getVal('dataForSeoPassword')
    const namecheapUser = getVal('namecheapApiUser')
    const namecheapKey = getVal('namecheapApiKey')

    if (!whoisfreaksKey) {
      return Response.json({ success: false, error: 'WhoisFreaks API key not configured' })
    }

    // Load niches
    let niches = await prisma.niche.findMany({ where: { active: true } })
    if (nicheFilter) {
      niches = niches.filter(n => n.slug === nicheFilter)
      if (niches.length === 0) {
        return Response.json({ success: false, error: `Niche "${nicheFilter}" not found` })
      }
    }

    log.push(`Pipeline start — niche: ${nicheFilter || 'ALL'} (${niches.length} niches)`)

    // ENGINE 1: Download drops
    log.push('ENGINE 1: Downloading daily drops...')
    const allDrops = await downloadDailyDrops(whoisfreaksKey)
    log.push(`Downloaded: ${allDrops.length} domains`)
    if (allDrops.length === 0) return Response.json({ success: true, totalDrops: 0, log })

    // ENGINE 1b: Filter by niche keywords
    log.push('ENGINE 1b: Filtering by niche keywords...')
    const nicheData = niches.map(n => ({
      slug: n.slug,
      keywords: Array.isArray(n.keywords) ? n.keywords as string[] :
        typeof n.keywords === 'string' ? (n.keywords as string).split(',').map(k => k.trim()) : [],
      tlds: Array.isArray(n.targetTlds) ? n.targetTlds as string[] : []
    }))
    const matches = filterByNicheKeywords(allDrops, nicheData)
    log.push(`Niche matches: ${matches.length}`)
    if (matches.length === 0) return Response.json({ success: true, totalDrops: allDrops.length, nicheMatches: 0, log })

    // ENGINE 2: Verify availability
    log.push('ENGINE 2: Verifying availability...')
    const available = await verifyAvailability(matches, namecheapUser || undefined, namecheapKey || undefined, whoisfreaksKey)
    log.push(`Available: ${available.length}`)

    // ENGINE 3: Score with DataForSEO
    let scoredDomains: DomainScore[] = []
    if (dataForSeoEmail && dataForSeoPassword) {
      const toScore = available.filter(d => d.available).slice(0, 50)
      log.push(`ENGINE 3: Scoring ${toScore.length} domains...`)
      scoredDomains = await scoreDomains(toScore.map(d => ({ domain: d.domain, niche: d.niche, matchedKeyword: d.matchedKeyword })), dataForSeoEmail, dataForSeoPassword, 50)
      log.push(`Scored: ${scoredDomains.length}`)
    } else {
      log.push('ENGINE 3: DataForSEO not configured — skipping')
    }

    // ENGINE 4: Wayback
    const top = (scoredDomains.length > 0 ? scoredDomains.filter(d => d.score >= 30) : available.filter(d => d.available)).slice(0, 20)
    log.push(`ENGINE 4: Wayback analysis for ${top.length} domains...`)
    const verdicts = await batchAnalyzeHistory(top.map(d => d.domain))
    log.push(`Clean: ${Array.from(verdicts.values()).filter(v => v.verdict === 'CLEAN').length}, Toxic: ${Array.from(verdicts.values()).filter(v => v.verdict === 'TOXIC').length}`)

    // ENGINE 5: Google Index
    const clean = top.filter(d => { const v = verdicts.get(d.domain); return !v || v.verdict !== 'TOXIC'; }).slice(0, 15)
    let indexResults = new Map<string, { indexed: boolean; pageCount: number }>()
    if (dataForSeoEmail && dataForSeoPassword && clean.length > 0) {
      log.push(`ENGINE 5: Google index check for ${clean.length} domains...`)
      indexResults = await batchCheckGoogleIndex(clean.map(d => d.domain), dataForSeoEmail, dataForSeoPassword)
      log.push(`Indexed: ${Array.from(indexResults.values()).filter(r => r.indexed).length}`)
    }

    // Save to DB
    for (const match of matches.slice(0, 500)) {
      try {
        const scored = scoredDomains.find(s => s.domain === match.domain)
        const verdict = verdicts.get(match.domain)
        const idx = indexResults.get(match.domain)
        let score = scored?.score || 0
        if (idx?.indexed) score += 15
        if (verdict?.verdict === 'TOXIC') score = 0
        if (verdict?.verdict === 'CLEAN' && (verdict.snapshotCount ?? 0) > 20) score += 10
        const status = verdict?.verdict === 'TOXIC' ? 'REJECTED' : score >= 60 ? 'QUEUED' : 'PENDING'
        await prisma.domain.upsert({
          where: { name: match.domain },
          update: { score, status },
          create: { name: match.domain, tld: '.' + match.domain.split('.').slice(1).join('.'), status, source: 'hunt-pipeline', niche: match.niche, score, referringDomains: scored?.referringDomains || 0, domainAge: scored?.age || 0, googleIndexed: idx?.indexed || null, googlePageCount: idx?.pageCount || null }
        })
        saved++
      } catch {}
    }

    const elapsed = Math.round((Date.now() - startTime) / 1000)
    log.push(`Done in ${elapsed}s — saved ${saved} domains`)

    // Build results for Hunt page
    const results = matches.slice(0, 200).map(m => {
      const s = scoredDomains.find(d => d.domain === m.domain)
      const v = verdicts.get(m.domain)
      const idx = indexResults.get(m.domain)
      let score = s?.score || 0
      if (idx?.indexed) score += 15
      if (v?.verdict === 'TOXIC') score = 0
      if (v?.verdict === 'CLEAN' && (v.snapshotCount ?? 0) > 20) score += 10
      return {
        domain: m.domain, niche: m.niche, matchedKeyword: m.matchedKeyword, score,
        verdict: v?.verdict || 'unchecked', indexed: idx?.indexed || false, pageCount: idx?.pageCount || 0,
        traffic: s?.traffic || 0, keywords: s?.keywords || 0, refs: s?.referringDomains || 0, age: s?.age || 0,
        status: v?.verdict === 'TOXIC' ? 'REJECTED' : score >= 60 ? 'QUEUED' : 'PENDING'
      }
    }).sort((a, b) => b.score - a.score)

    return Response.json({
      success: true, totalDrops: allDrops.length, nicheMatches: matches.length,
      available: available.filter(a => a.available).length, scored: scoredDomains.length,
      cleanHistory: Array.from(verdicts.values()).filter(v => v.verdict === 'CLEAN').length,
      googleIndexed: Array.from(indexResults.values()).filter(r => r.indexed).length,
      queued: results.filter(r => r.status === 'QUEUED').length,
      domainsSaved: saved, elapsed: `${elapsed}s`, results, log
    })
  } catch (error) {
    return Response.json({ success: false, error: String(error), log }, { status: 500 })
  }
}
