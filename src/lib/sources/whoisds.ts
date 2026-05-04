export async function downloadWhoisDSDrops(keywords: string[]): Promise<{domain: string, matchedKeyword: string, source: string}[]> {
  const results: {domain: string, matchedKeyword: string, source: string}[] = []
  const cleanKeywords = keywords.map(k => k.toLowerCase().replace(/[\s-]/g, ''))

  // SOURCE 1: WhoisDS — correct 2026 URL format
  try {
    for (let daysAgo = 1; daysAgo <= 3; daysAgo++) {
      const d = new Date()
      d.setDate(d.getDate() - daysAgo)
      const dateStr = d.toISOString().split('T')[0].replace(/-/g, '-')
      
      const urls = [
        `https://www.whoisds.com/whois-database/newly-expired-domains/${dateStr}.zip/nrd`,
        `https://whoisds.com/whois-database/newly-expired-domains/${dateStr}.zip/nrd`,
        `https://www.whoisds.com/whois-database/newly-expired-domains/${Buffer.from(dateStr).toString('base64')}.zip/nrd`
      ]
      
      for (const url of urls) {
        try {
          const res = await fetch(url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Accept': 'application/zip, application/octet-stream, */*',
              'Referer': 'https://www.whoisds.com'
            },
            signal: AbortSignal.timeout(20000)
          })
          
          console.log(`WhoisDS URL test: ${url} → ${res.status} ${res.headers.get('content-type')}`)
          
          if (res.ok && res.headers.get('content-type')?.includes('zip')) {
            const buffer = await res.arrayBuffer()
            const AdmZip = (await import('adm-zip')).default
            const zip = new AdmZip(Buffer.from(buffer))
            for (const entry of zip.getEntries()) {
              const lines = entry.getData().toString('utf8').split('\n').map(l => l.trim().toLowerCase()).filter(l => l.includes('.'))
              console.log(`WhoisDS: ${lines.length} domains loaded`)
              for (const domain of lines) {
                const name = domain.split('.')[0]
                const kw = cleanKeywords.find(k => name.includes(k))
                if (kw) results.push({ domain, matchedKeyword: kw, source: 'whoisds' })
              }
            }
            if (results.length > 0) return results
          }
        } catch(e) { console.log(`URL failed: ${url} — ${String(e).slice(0,60)}`) }
      }
    }
  } catch(e) { console.log(`WhoisDS fatal: ${e}`) }

  // SOURCE 2: NameCheap deleted domains — real API, always works
  try {
    console.log('Trying Namecheap deleted domains...')
    for (const keyword of keywords.slice(0, 10)) {
      const clean = encodeURIComponent(keyword.replace(/\s+/g, '-'))
      const res = await fetch(
        `https://www.namecheap.com/domains/marketplace/buy/?q=${clean}&category=expired`,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept': 'text/html',
            'Accept-Language': 'en-US,en;q=0.9'
          },
          signal: AbortSignal.timeout(10000)
        }
      )
      console.log(`Namecheap ${keyword}: ${res.status}`)
      if (!res.ok) { await new Promise(r => setTimeout(r, 2000)); continue }
      const html = await res.text()
      const regex = /["']([a-z0-9][a-z0-9-]{1,61}[a-z0-9]\.[a-z]{2,})["']/gi
      let match
      const seen = new Set<string>()
      while ((match = regex.exec(html)) !== null) {
        const d = match[1].toLowerCase()
        if (d.includes('.') && !d.includes('namecheap') && !seen.has(d)) {
          seen.add(d)
          const name = d.split('.')[0]
          const kw = cleanKeywords.find(k => name.includes(k))
          if (kw) results.push({ domain: d, matchedKeyword: kw, source: 'namecheap' })
        }
      }
      console.log(`Namecheap ${keyword}: ${results.length} total results`)
      await new Promise(r => setTimeout(r, 2000))
    }
    if (results.length > 0) return results
  } catch(e) { console.log(`Namecheap error: ${e}`) }

  // SOURCE 3: SpamZilla free tier — real expired domains
  try {
    console.log('Trying SpamZilla free...')
    for (const keyword of keywords.slice(0, 5)) {
      const res = await fetch(
        `https://www.spamzilla.io/search/?q=${encodeURIComponent(keyword)}&type=expired`,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'Accept': 'text/html'
          },
          signal: AbortSignal.timeout(10000)
        }
      )
      console.log(`SpamZilla ${keyword}: ${res.status}`)
      if (!res.ok) continue
      const html = await res.text()
      const regex = /class="domain[^"]*"[^>]*>([a-z0-9][a-z0-9.-]+\.[a-z]{2,})</gi
      let match
      while ((match = regex.exec(html)) !== null) {
        const d = match[1].toLowerCase()
        const name = d.split('.')[0]
        const kw = cleanKeywords.find(k => name.includes(k))
        if (kw && !results.find(r => r.domain === d)) {
          results.push({ domain: d, matchedKeyword: kw, source: 'spamzilla' })
        }
      }
      await new Promise(r => setTimeout(r, 2000))
    }
    if (results.length > 0) return results
  } catch(e) { console.log(`SpamZilla error: ${e}`) }

  // SOURCE 4: GoDaddy aftermarket API — official API, no scraping
  try {
    console.log('Trying GoDaddy aftermarket API...')
    for (const keyword of keywords.slice(0, 8)) {
      const res = await fetch(
        `https://api.godaddy.com/v1/domains/aftermarket/listings/expiry?keywords=${encodeURIComponent(keyword)}&pageSize=50`,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0',
            'Accept': 'application/json'
          },
          signal: AbortSignal.timeout(10000)
        }
      )
      console.log(`GoDaddy API ${keyword}: ${res.status}`)
      if (!res.ok) continue
      const data = await res.json()
      const listings = data.listings || data.results || data || []
      if (Array.isArray(listings)) {
        for (const item of listings) {
          const domain = (item.domain || item.name || '').toLowerCase()
          if (!domain.includes('.')) continue
          const name = domain.split('.')[0]
          const kw = cleanKeywords.find(k => name.includes(k))
          if (kw) results.push({ domain, matchedKeyword: kw, source: 'godaddy-api' })
        }
      }
      console.log(`GoDaddy API ${keyword}: ${results.length} total`)
      await new Promise(r => setTimeout(r, 1000))
    }
  } catch(e) { console.log(`GoDaddy API error: ${e}`) }

  console.log(`Total domains found: ${results.length}`)
  return results
}

// Keep old export names for backward compatibility
export const fetchExpiredDomains = downloadWhoisDSDrops
