// Downloads daily dropped domains from WhoisFreaks
// These are domains that JUST DROPPED and are available to register NOW
// Returns JSON array of domain names
// Cost: included in $29/month Domainer Subscription

export async function downloadDailyDrops(apiKey: string): Promise<string[]> {
  const allDomains: string[] = []
  
  // Try today and yesterday (file publishes at 03:00 UTC)
  const dates = [0, 1].map(daysAgo => {
    const d = new Date()
    d.setDate(d.getDate() - daysAgo)
    return d.toISOString().split('T')[0]
  })
  
  for (const date of dates) {
    try {
      console.log(`[VOLUME] Downloading drops for ${date}...`)
      
      const url = `https://files.whoisfreaks.com/v3.3/download/domainer/dropped?apiKey=${apiKey}&date=${date}`
      
      const res = await fetch(url, {
        signal: AbortSignal.timeout(60000) // 60s — file can be large
      })
      
      console.log(`[VOLUME] ${date}: ${res.status} ${res.headers.get('content-type')}`)
      
      if (!res.ok) {
        console.log(`[VOLUME] ${date}: HTTP ${res.status} — trying next date`)
        continue
      }
      
      const data = await res.json()
      
      if (Array.isArray(data) && data.length > 0) {
        for (const item of data) {
          const domain = (typeof item === 'string' ? item : item.domain || item.domainName || '').toLowerCase().trim()
          if (domain && domain.includes('.') && domain.length > 3 && domain.length < 80) {
            allDomains.push(domain)
          }
        }
        console.log(`[VOLUME] ${date}: ${allDomains.length} domains loaded ✅`)
        break // Got data, no need to try yesterday
      }
      
    } catch (e) {
      console.log(`[VOLUME] ${date} error: ${String(e).slice(0, 100)}`)
    }
  }
  
  // Also try expired feed for more volume
  if (allDomains.length < 1000) {
    try {
      const date = dates[0]
      const url = `https://files.whoisfreaks.com/v3.1/download/domainer/expired?apiKey=${apiKey}&date=${date}`
      
      console.log(`[VOLUME] Also fetching expired feed for ${date}...`)
      
      const res = await fetch(url, { signal: AbortSignal.timeout(60000) })
      
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data)) {
          const before = allDomains.length
          for (const item of data) {
            const domain = (typeof item === 'string' ? item : item.domain || '').toLowerCase().trim()
            if (domain && domain.includes('.') && !allDomains.includes(domain)) {
              allDomains.push(domain)
            }
          }
          console.log(`[VOLUME] Expired feed added ${allDomains.length - before} more domains`)
        }
      }
    } catch (e) {
      console.log(`[VOLUME] Expired feed error: ${String(e).slice(0, 80)}`)
    }
  }
  
  console.log(`[VOLUME] TOTAL: ${allDomains.length} domains downloaded`)
  return allDomains
}

// Filter domains by niche keywords — runs locally, FREE, instant
export function filterByNicheKeywords(
  domains: string[],
  niches: { slug: string, keywords: string[], tlds?: string[] }[]
): { domain: string, niche: string, matchedKeyword: string }[] {
  
  const results: { domain: string, niche: string, matchedKeyword: string }[] = []
  const seen = new Set<string>()
  
  // Prepare keyword map for fast lookup
  const keywordMap: { keyword: string, niche: string }[] = []
  for (const niche of niches) {
    const kws = Array.isArray(niche.keywords) ? niche.keywords : []
    for (const kw of kws) {
      const clean = kw.toLowerCase().replace(/[\s\-_]/g, '')
      if (clean.length >= 2) {
        keywordMap.push({ keyword: clean, niche: niche.slug })
      }
    }
  }
  
  // Junk TLDs to skip
  const junkTLDs = new Set([
    '.xyz', '.top', '.click', '.store', '.site', '.online', '.live',
    '.club', '.buzz', '.icu', '.space', '.fun', '.bid', '.win',
    '.loan', '.download', '.stream', '.racing', '.review', '.party',
    '.science', '.work', '.date', '.faith', '.cricket', '.accountant'
  ])
  
  for (const domain of domains) {
    if (seen.has(domain)) continue
    
    const parts = domain.split('.')
    if (parts.length < 2) continue
    
    const name = parts[0].toLowerCase()
    const tld = '.' + parts.slice(1).join('.')
    
    // Skip junk TLDs
    if (junkTLDs.has(tld)) continue
    
    // Skip too long or too short
    if (name.length > 35 || name.length < 3) continue
    
    // Skip random strings (5+ consonants in a row)
    if (/[bcdfghjklmnpqrstvwxz]{5,}/i.test(name)) continue
    
    // Skip domains that are just numbers
    if (/^\d+$/.test(name)) continue
    
    // Check keyword match
    for (const { keyword, niche } of keywordMap) {
      if (name.includes(keyword)) {
        seen.add(domain)
        results.push({ domain, niche, matchedKeyword: keyword })
        break
      }
    }
  }
  
  console.log(`[FILTER] ${domains.length} total → ${results.length} niche matches`)
  return results
}
