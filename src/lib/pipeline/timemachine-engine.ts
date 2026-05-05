// Checks domain history via Archive.org CDX API
// Determines if domain was legitimate or spam/toxic
// Cost: FREE

export interface WaybackVerdict {
  domain: string
  snapshotCount: number
  firstSeen: string | null
  lastSeen: string | null
  titles: string[]
  verdict: 'CLEAN' | 'SUSPICIOUS' | 'TOXIC' | 'NO_HISTORY'
  severity: number // 0-100, lower = cleaner
  reason: string
}

export async function analyzeHistory(domain: string): Promise<WaybackVerdict> {
  const result: WaybackVerdict = {
    domain,
    snapshotCount: 0,
    firstSeen: null,
    lastSeen: null,
    titles: [],
    verdict: 'NO_HISTORY',
    severity: 50,
    reason: 'No archive data found'
  }
  
  try {
    // Get snapshot count and date range
    const cdxUrl = `https://web.archive.org/cdx/search/cdx?url=${domain}&output=json&fl=timestamp,statuscode&limit=200&filter=statuscode:200`
    
    const res = await fetch(cdxUrl, { signal: AbortSignal.timeout(10000) })
    
    if (!res.ok) return result
    
    const data = await res.json()
    
    if (!Array.isArray(data) || data.length <= 1) return result
    
    // First row is header
    const snapshots = data.slice(1)
    result.snapshotCount = snapshots.length
    
    if (snapshots.length > 0) {
      result.firstSeen = snapshots[0][0]?.slice(0, 4) || null // year
      result.lastSeen = snapshots[snapshots.length - 1][0]?.slice(0, 4) || null
    }
    
    // Fetch actual page content from most recent snapshot
    if (snapshots.length > 0) {
      const latestTimestamp = snapshots[snapshots.length - 1][0]
      
      try {
        const pageUrl = `https://web.archive.org/web/${latestTimestamp}/${domain}`
        const pageRes = await fetch(pageUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          signal: AbortSignal.timeout(8000),
          redirect: 'follow'
        })
        
        if (pageRes.ok) {
          const html = await pageRes.text()
          
          // Extract title
          const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
          if (titleMatch) {
            result.titles.push(titleMatch[1].trim())
          }
          
          const lowerHtml = html.toLowerCase()
          
          // Toxic signals
          const toxicPatterns = [
            'casino', 'gambling', 'poker', 'slot machine', 'sports betting',
            'viagra', 'cialis', 'pharmacy', 'buy pills', 'cheap pills',
            'porn', 'xxx', 'adult content', 'sex chat',
            'payday loan', 'make money fast', 'get rich quick',
            'hack', 'crack', 'keygen', 'warez'
          ]
          
          const toxicMatches = toxicPatterns.filter(p => lowerHtml.includes(p))
          
          // Chinese/Japanese/Korean spam signals
          const cjkPattern = /[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff]{10,}/
          const hasCJKSpam = cjkPattern.test(html)
          
          // PBN signals
          const pbnPatterns = ['private blog network', 'pbn', 'link building service', 'buy backlinks', 'sponsored post network']
          const pbnMatches = pbnPatterns.filter(p => lowerHtml.includes(p))
          
          if (toxicMatches.length >= 2 || hasCJKSpam) {
            result.verdict = 'TOXIC'
            result.severity = 90
            result.reason = `Toxic content detected: ${toxicMatches.join(', ')}${hasCJKSpam ? ' + CJK spam' : ''}`
          } else if (toxicMatches.length === 1 || pbnMatches.length > 0) {
            result.verdict = 'SUSPICIOUS'
            result.severity = 60
            result.reason = `Suspicious: ${[...toxicMatches, ...pbnMatches].join(', ')}`
          } else if (snapshots.length >= 5) {
            result.verdict = 'CLEAN'
            result.severity = 10
            result.reason = `Clean history, ${snapshots.length} snapshots from ${result.firstSeen} to ${result.lastSeen}`
          } else {
            result.verdict = 'CLEAN'
            result.severity = 30
            result.reason = `Limited history (${snapshots.length} snapshots) but no toxic signals`
          }
        }
      } catch {
        // Page fetch failed — judge by snapshot count only
        if (snapshots.length >= 10) {
          result.verdict = 'CLEAN'
          result.severity = 20
          result.reason = `${snapshots.length} snapshots, content not accessible for review`
        }
      }
    }
    
  } catch (e) {
    console.log(`[TIMEMACHINE] ${domain}: ${String(e).slice(0, 60)}`)
  }
  
  console.log(`[TIMEMACHINE] ${domain}: ${result.verdict} (severity ${result.severity}%) — ${result.reason.slice(0, 80)}`)
  return result
}

// Batch analyze multiple domains
export async function batchAnalyzeHistory(
  domains: string[],
  maxConcurrent: number = 3
): Promise<Map<string, WaybackVerdict>> {
  
  const results = new Map<string, WaybackVerdict>()
  
  for (let i = 0; i < domains.length; i += maxConcurrent) {
    const batch = domains.slice(i, i + maxConcurrent)
    
    const batchResults = await Promise.allSettled(
      batch.map(domain => analyzeHistory(domain))
    )
    
    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        results.set(result.value.domain, result.value)
      }
    }
    
    await new Promise(r => setTimeout(r, 1000))
  }
  
  console.log(`[TIMEMACHINE] Analyzed ${results.size} domains`)
  return results
}
