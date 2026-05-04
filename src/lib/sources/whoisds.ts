export async function downloadWhoisDSDrops(keywords: string[]): Promise<{domain: string, matchedKeyword: string, source: string}[]> {
  const results: {domain: string, matchedKeyword: string, source: string}[] = []
  
  // Try last 3 days
  for (let daysAgo = 0; daysAgo <= 3; daysAgo++) {
    const d = new Date()
    d.setDate(d.getDate() - daysAgo)
    const date = d.toISOString().split('T')[0]
    
    try {
      const url = `https://www.whoisds.com/whois-database/newly-expired-domains/${date}.zip/nrd`
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive'
        },
        signal: AbortSignal.timeout(25000)
      })
      
      console.log(`WhoisDS ${date}: ${res.status} ${res.headers.get('content-type')}`)
      
      if (!res.ok) continue
      
      const contentType = res.headers.get('content-type') || ''
      if (!contentType.includes('zip') && !contentType.includes('octet')) {
        const text = await res.text()
        console.log(`WhoisDS not zip: ${text.slice(0, 200)}`)
        continue
      }
      
      const buffer = await res.arrayBuffer()
      console.log(`WhoisDS zip size: ${buffer.byteLength} bytes`)
      
      if (buffer.byteLength < 100) continue
      
      const AdmZip = (await import('adm-zip')).default
      const zip = new AdmZip(Buffer.from(buffer))
      const entries = zip.getEntries()
      
      for (const entry of entries) {
        const content = entry.getData().toString('utf8')
        const lines = content.split('\n').map(l => l.trim().toLowerCase()).filter(l => l.includes('.'))
        
        console.log(`WhoisDS ${date}: ${lines.length} total domains`)
        
        for (const domain of lines) {
          const name = domain.split('.')[0]
          const kw = keywords.find(k => name.includes(k.toLowerCase().replace(/[\s-]/g, '')))
          if (kw) results.push({ domain, matchedKeyword: kw, source: 'whoisds' })
        }
        
        if (results.length > 0) {
          console.log(`WhoisDS: ${results.length} keyword matches`)
          return results
        }
      }
    } catch (e) {
      console.log(`WhoisDS ${date} error: ${String(e).slice(0, 100)}`)
    }
  }
  
  // FALLBACK 1: nrd.whoisxmlapi.com — free tier, no auth needed
  try {
    console.log('Trying WhoisXML NRD API...')
    const today = new Date().toISOString().split('T')[0]
    const res = await fetch(
      `https://newly-registered-domains.whoisxmlapi.com/api/v1?apiKey=at_free&date=${today}&type=expired`,
      { signal: AbortSignal.timeout(15000) }
    )
    if (res.ok) {
      const data = await res.json()
      const domains: string[] = data.domainsList || []
      console.log(`WhoisXML: ${domains.length} total domains`)
      for (const domain of domains) {
        const name = domain.split('.')[0].toLowerCase()
        const kw = keywords.find(k => name.includes(k.toLowerCase().replace(/[\s-]/g, '')))
        if (kw) results.push({ domain: domain.toLowerCase(), matchedKeyword: kw, source: 'whoisxml' })
      }
      if (results.length > 0) return results
    }
  } catch (e) {
    console.log(`WhoisXML error: ${String(e).slice(0, 80)}`)
  }
  
  // FALLBACK 2: expireddomains.net with session
  try {
    console.log('Trying ExpiredDomains with session...')
    // First get session cookie
    const sessionRes = await fetch('https://www.expireddomains.net/', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36' }
    })
    const cookies = sessionRes.headers.get('set-cookie') || ''
    
    for (const keyword of keywords.slice(0, 8)) {
      const clean = keyword.replace(/\s+/g, '-').replace(/[^a-z0-9-]/gi, '')
      const res = await fetch(
        `https://www.expireddomains.net/domain-search/?q=${clean}&ftlds[]=com&ftlds[]=net&ftlds[]=io&ftlds[]=de&ftlds[]=fr&ftlds[]=nl&ftlds[]=co.uk`,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept': 'text/html',
            'Referer': 'https://www.expireddomains.net',
            'Cookie': cookies
          },
          signal: AbortSignal.timeout(12000)
        }
      )
      
      console.log(`ExpiredDomains ${keyword}: ${res.status}`)
      
      if (!res.ok) { await new Promise(r => setTimeout(r, 3000)); continue }
      
      const html = await res.text()
      const regex = /<td class="field_domain[^"]*">\s*<a[^>]*>([a-z0-9][a-z0-9.-]+\.[a-z]{2,6})<\/a>/gi
      let match
      while ((match = regex.exec(html)) !== null) {
        const domain = match[1].toLowerCase()
        if (!results.find(r => r.domain === domain)) {
          results.push({ domain, matchedKeyword: keyword, source: 'expireddomains' })
        }
      }
      
      console.log(`ExpiredDomains ${keyword}: total results ${results.length}`)
      await new Promise(r => setTimeout(r, 3000))
    }
  } catch (e) {
    console.log(`ExpiredDomains error: ${String(e).slice(0, 80)}`)
  }
  
  return results
}

// Keep old export names for backward compatibility
export const fetchExpiredDomains = downloadWhoisDSDrops
