export async function fetchDroppedDomains(apiKey: string): Promise<string[]> {
  const domains: string[] = []
  
  // Try today and yesterday
  const dates = [0, 1].map(daysAgo => {
    const d = new Date()
    d.setDate(d.getDate() - daysAgo)
    return d.toISOString().split('T')[0]
  })

  for (const date of dates) {
    try {
      // Dropped domains = actually available to register
      const url = `https://files.whoisfreaks.com/v3.3/download/domainer/dropped?apiKey=${apiKey}&date=${date}`
      
      console.log(`WhoisFreaks: fetching dropped domains for ${date}`)
      
      const res = await fetch(url, {
        signal: AbortSignal.timeout(30000)
      })
      
      console.log(`WhoisFreaks ${date}: ${res.status} ${res.headers.get('content-type')}`)
      
      if (!res.ok) {
        console.log(`WhoisFreaks ${date}: ${res.status} — trying next date`)
        continue
      }
      
      const text = await res.text()
      
      // Parse response — could be JSON array or CSV
      try {
        const parsed = JSON.parse(text)
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            const domain = typeof item === 'string' ? item : item.domainName || item.domain || ''
            if (domain && domain.includes('.')) {
              domains.push(domain.toLowerCase().trim())
            }
          }
        }
      } catch {
        // Try CSV/line format
        const lines = text.split('\n').map(l => l.trim()).filter(l => l.includes('.') && l.length > 3 && l.length < 80)
        for (const line of lines) {
          // Extract domain from CSV line (first column)
          const domain = line.split(',')[0].replace(/"/g, '').trim().toLowerCase()
          if (domain.includes('.') && !domain.includes(' ')) {
            domains.push(domain)
          }
        }
      }
      
      console.log(`WhoisFreaks ${date}: loaded ${domains.length} domains`)
      
      if (domains.length > 0) break
      
    } catch (e) {
      console.log(`WhoisFreaks ${date} error: ${String(e).slice(0, 100)}`)
    }
  }

  // Also try expired domains feed
  if (domains.length === 0) {
    try {
      const date = dates[0]
      const url = `https://files.whoisfreaks.com/v3.1/download/domainer/expired?apiKey=${apiKey}&date=${date}`
      
      console.log(`WhoisFreaks: trying expired feed for ${date}`)
      
      const res = await fetch(url, { signal: AbortSignal.timeout(30000) })
      
      console.log(`WhoisFreaks expired ${date}: ${res.status}`)
      
      if (res.ok) {
        const text = await res.text()
        try {
          const parsed = JSON.parse(text)
          if (Array.isArray(parsed)) {
            for (const item of parsed) {
              const domain = typeof item === 'string' ? item : item.domainName || item.domain || ''
              if (domain && domain.includes('.')) {
                domains.push(domain.toLowerCase().trim())
              }
            }
          }
        } catch {
          const lines = text.split('\n').map(l => l.trim()).filter(l => l.includes('.'))
          for (const line of lines) {
            const domain = line.split(',')[0].replace(/"/g, '').trim().toLowerCase()
            if (domain.includes('.') && !domain.includes(' ')) {
              domains.push(domain)
            }
          }
        }
        console.log(`WhoisFreaks expired: loaded ${domains.length} domains`)
      }
    } catch (e) {
      console.log(`WhoisFreaks expired error: ${String(e).slice(0, 100)}`)
    }
  }

  console.log(`WhoisFreaks TOTAL: ${domains.length} domains loaded`)
  return [...new Set(domains)] // deduplicate
}

export function filterByKeywords(domains: string[], keywords: string[]): {domain: string, matchedKeyword: string}[] {
  const results: {domain: string, matchedKeyword: string}[] = []
  const cleanKeywords = keywords.map(k => k.toLowerCase().replace(/[\s\-_]/g, ''))
  
  for (const domain of domains) {
    const name = domain.split('.')[0].toLowerCase()
    const tld = '.' + domain.split('.').slice(1).join('.')
    
    // Skip junk TLDs
    const junkTLDs = ['.xyz', '.top', '.click', '.store', '.site', '.online', '.live', '.club', '.buzz', '.icu']
    if (junkTLDs.includes(tld)) continue
    
    // Skip too long or too short
    if (name.length > 30 || name.length < 3) continue
    
    // Skip random strings (too many consonants in a row)
    if (/[bcdfghjklmnpqrstvwxz]{5,}/i.test(name)) continue
    
    // Check keyword match
    for (const kw of cleanKeywords) {
      if (name.includes(kw)) {
        results.push({ domain, matchedKeyword: kw })
        break
      }
    }
  }
  
  return results
}
