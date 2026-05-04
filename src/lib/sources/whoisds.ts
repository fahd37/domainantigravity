export interface WhoisDSDomain {
  domain: string
  source: 'whoisds' | 'expireddomains' | 'namecheap-market' | 'domaindb' | 'freshdrops' | 'expired-scan'
  matchedKeyword: string
  discoveredAt: Date
}

export async function fetchExpiredDomains(keywords: string[]): Promise<WhoisDSDomain[]> {
  const domains: WhoisDSDomain[] = []
  const seen = new Set<string>()
  
  // Source 1: WhoisDS - try multiple date formats
  try {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const dateStr = yesterday.toISOString().split('T')[0]
    
    const res = await fetch(
      `https://www.whoisds.com/whois-database/newly-expired-domains/${dateStr}.zip/nrd`,
      { 
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(15000)
      }
    )
    
    if (res.ok) {
      const buffer = await res.arrayBuffer()
      const AdmZip = (await import('adm-zip')).default
      const zip = new AdmZip(Buffer.from(buffer))
      const entry = zip.getEntries()[0]
      if (entry) {
        const content = entry.getData().toString('utf8')
        const lines = content.split('\n').map(l => l.trim()).filter(Boolean)
        console.log(`WhoisDS: ${lines.length} total domains`)
        
        for (const line of lines) {
          const domain = line.toLowerCase().trim()
          if (!domain.includes('.') || seen.has(domain)) continue
          const name = domain.split('.')[0]
          const matchedKw = keywords.find(kw => name.includes(kw.toLowerCase().replace(/\s+/g, '')))
          if (matchedKw) {
            seen.add(domain)
            domains.push({
              domain,
              source: 'whoisds',
              matchedKeyword: matchedKw,
              discoveredAt: new Date()
            })
          }
        }
        console.log(`WhoisDS: ${domains.length} keyword matches`)
      }
    }
  } catch (e) {
    console.log('WhoisDS failed:', String(e).slice(0, 100))
  }

  // Source 2: ExpiredDomains.net
  for (const keyword of keywords.slice(0, 5)) {
    try {
      const clean = keyword.replace(/\s+/g, '-').replace(/[^a-z0-9-]/gi, '')
      const res = await fetch(
        `https://www.expireddomains.net/domain-search/?q=${clean}&ftlds[]=com&ftlds[]=net&ftlds[]=io&ftlds[]=de&ftlds[]=fr&ftlds[]=nl`,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'Accept': 'text/html,application/xhtml+xml',
            'Accept-Language': 'en-US,en;q=0.9',
            'Referer': 'https://www.expireddomains.net',
            'Cookie': 'wc_cart_hash_b96a4c7b80485088e896b2ed6e7d2cf8=; _ga=GA1.2'
          },
          signal: AbortSignal.timeout(10000)
        }
      )

      if (!res.ok) {
        console.log(`ExpiredDomains ${keyword}: ${res.status}`)
        continue
      }

      const html = await res.text()
      
      // Parse domain table
      const regex = /<td class="field_domain[^"]*">\s*<a[^>]*>([a-z0-9][a-z0-9.-]+\.[a-z]{2,})<\/a>/gi
      let match
      while ((match = regex.exec(html)) !== null) {
        const domain = match[1].toLowerCase()
        if (!seen.has(domain)) {
          seen.add(domain)
          domains.push({
            domain,
            source: 'expireddomains',
            matchedKeyword: keyword,
            discoveredAt: new Date()
          })
        }
      }
      
      console.log(`ExpiredDomains ${keyword}: found domains, total: ${domains.length}`)
      await new Promise(r => setTimeout(r, 2000))
      
    } catch (e) {
      console.log(`ExpiredDomains ${keyword} error:`, String(e).slice(0, 80))
    }
  }

  return domains
}

export const downloadWhoisDSDrops = fetchExpiredDomains;
