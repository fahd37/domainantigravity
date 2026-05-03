/* eslint-disable @typescript-eslint/no-explicit-any */
import AdmZip from 'adm-zip'

export interface WhoisDSDomain {
  domain: string
  source: 'whoisds' | 'expireddomains' | 'namecheap-market' | 'domaindb' | 'freshdrops'
  matchedKeyword: string
  discoveredAt: Date
}

const ALLOWED_TLDS = ['.com', '.net', '.io', '.de', '.co', '.org', '.ai', '.fr', '.nl', '.tv', '.se', '.no', '.dk']

function filterRawLines(lines: string[], keywords: string[], source: WhoisDSDomain['source']): WhoisDSDomain[] {
  const matched: WhoisDSDomain[] = []
  const seen = new Set<string>()

  for (const line of lines) {
    const domain = line.toLowerCase().trim()
    if (!domain || domain.includes(' ') || domain.startsWith('#')) continue

    const parts = domain.split('.')
    if (parts.length < 2 || domain.length > 63) continue

    const name = parts.slice(0, -1).join('.')
    const tld = '.' + parts[parts.length - 1]

    if (!ALLOWED_TLDS.includes(tld)) continue
    if (seen.has(domain)) continue

    const matchedKeyword = keywords.find(kw =>
      name.includes(kw.toLowerCase().replace(/[^a-z0-9]/g, ''))
    )
    if (!matchedKeyword) continue

    seen.add(domain)
    matched.push({ domain, source, matchedKeyword, discoveredAt: new Date() })
  }

  return matched
}

// ─── SOURCE 1: WhoisDS (tries multiple URL formats + dates) ───────────────────
async function fetchWhoisDSDrops(keywords: string[]): Promise<WhoisDSDomain[]> {
  const utcHour = new Date().getUTCHours()
  const dateOffsets = utcHour < 10 ? [1, 2] : [0, 1, 2]

  const dates = dateOffsets.map(daysAgo => {
    const d = new Date()
    d.setDate(d.getDate() - daysAgo)
    return d.toISOString().split('T')[0]
  })

  for (const date of dates) {
    const formats = [
      `https://www.whoisds.com/whois-database/newly-expired-domains/${date}.zip/nrd`,
      `https://whoisds.com/whois-database/newly-expired-domains/${date}.zip/nrd`,
      `https://www.whoisds.com/whois-database/newly-registered-domains/${date}.zip/nrd`,
      `https://www.whoisds.com/whois-database/newly-expired-domains/${Buffer.from(date).toString('base64')}.zip/nrd`
    ]

    for (const url of formats) {
      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'Accept': 'application/zip, */*',
            'Referer': 'https://www.whoisds.com'
          },
          signal: AbortSignal.timeout(20000)
        })

        if (!response.ok) continue

        const buffer = await response.arrayBuffer()
        if (buffer.byteLength < 500) continue

        const zip = new AdmZip(Buffer.from(buffer))
        const entries = zip.getEntries()

        let rawLines: string[] = []
        for (const entry of entries) {
          if (entry.entryName.endsWith('.txt') || entry.entryName.endsWith('.csv')) {
            const content = entry.getData().toString('utf8')
            rawLines = content.split('\n').map((l: string) => l.trim()).filter(Boolean)
            break
          }
        }

        if (rawLines.length === 0) continue

        console.log(`WhoisDS: ${url} worked for ${date} (${rawLines.length} raw domains)`)
        const matched = filterRawLines(rawLines, keywords, 'whoisds')
        if (matched.length > 0) return matched
      } catch {
        // Try next
      }
    }
  }

  return []
}

// ─── SOURCE 2: ExpiredDomains.net (no-space keyword search) ──────────────────
export async function scrapeExpiredDomainsReliable(keywords: string[]): Promise<WhoisDSDomain[]> {
  const results: WhoisDSDomain[] = []
  const seen = new Set<string>()

  for (const keyword of keywords.slice(0, 10)) {
    try {
      // Clean keyword — no spaces, no special chars
      const clean = keyword.toLowerCase()
        .replace(/\s+/g, '')
        .replace(/[^a-z0-9]/g, '')

      const url = `https://www.expireddomains.net/domain-search/?q=${clean}&ftlds[]=com&ftlds[]=net&ftlds[]=io&ftlds[]=de&ftlds[]=fr&ftlds[]=nl&start=0`

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Accept': 'text/html',
          'Accept-Language': 'en-US,en;q=0.9',
          'Referer': 'https://www.expireddomains.net'
        },
        signal: AbortSignal.timeout(15000)
      })

      if (!response.ok) continue

      const html = await response.text()

      // Parse domain rows from table using the proven regex
      const domainRegex = /class="field_domain"[^>]*>\s*<a[^>]*>([a-z0-9][a-z0-9\-]{1,61}[a-z0-9]\.[a-z]{2,})<\/a>/gi
      let match
      while ((match = domainRegex.exec(html)) !== null) {
        const domain = match[1].toLowerCase().trim()
        if (domain && !domain.includes('expireddomains') && !seen.has(domain)) {
          seen.add(domain)
          results.push({ domain, source: 'expireddomains', matchedKeyword: keyword, discoveredAt: new Date() })
        }
      }

      // Fallback broader regex
      const broadRegex = /\b([a-z0-9][a-z0-9\-]{1,50}\.(com|net|org|io|co|ai|de|fr|nl|tv))\b/gi
      while ((match = broadRegex.exec(html)) !== null) {
        const domain = match[1].toLowerCase()
        if (!seen.has(domain) && !domain.includes('expireddomains')) {
          const tld = '.' + domain.split('.').pop()
          if (ALLOWED_TLDS.includes(tld)) {
            seen.add(domain)
            results.push({ domain, source: 'expireddomains', matchedKeyword: keyword, discoveredAt: new Date() })
          }
        }
      }

      // 3 second delay between requests to avoid rate limiting
      await new Promise(r => setTimeout(r, 3000))

    } catch (e) {
      console.log(`ExpiredDomains failed for ${keyword}:`, e)
      continue
    }
  }

  console.log(`ExpiredDomains: ${results.length} domains found`)
  return results
}

// ─── SOURCE 3: NameCheap Marketplace ─────────────────────────────────────────
export async function scrapeNamecheapMarket(keywords: string[]): Promise<WhoisDSDomain[]> {
  const results: WhoisDSDomain[] = []
  const seen = new Set<string>()

  for (const keyword of keywords.slice(0, 5)) {
    try {
      const clean = keyword.replace(/\s+/g, '+')
      const url = `https://www.namecheap.com/domains/marketplace/buy/?q=${clean}`

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
          'Accept': 'text/html'
        },
        signal: AbortSignal.timeout(10000)
      })

      if (!response.ok) continue

      const html = await response.text()

      // data-domain attribute
      const attrRegex = /data-domain="([a-z0-9][a-z0-9\-\.]{1,61}[a-z0-9])"/gi
      let match
      while ((match = attrRegex.exec(html)) !== null) {
        const domain = match[1].toLowerCase()
        if (!seen.has(domain)) {
          seen.add(domain)
          results.push({ domain, source: 'namecheap-market', matchedKeyword: keyword, discoveredAt: new Date() })
        }
      }

      // Broad domain pattern fallback
      const broadRegex = /\b([a-z0-9][a-z0-9\-]{1,50}\.(com|net|io|co|tv))\b/gi
      while ((match = broadRegex.exec(html)) !== null) {
        const domain = match[1].toLowerCase()
        if (!seen.has(domain) && !domain.includes('namecheap')) {
          seen.add(domain)
          results.push({ domain, source: 'namecheap-market', matchedKeyword: keyword, discoveredAt: new Date() })
        }
      }

      await new Promise(r => setTimeout(r, 2000))

    } catch (e) {
      console.log(`Namecheap market failed for ${keyword}:`, e)
      continue
    }
  }

  console.log(`Namecheap Market: ${results.length} domains found`)
  return results
}

// ─── SOURCE 4: DomainDB.com (free tier, no auth needed) ──────────────────────
export async function scrapeDomainDB(keywords: string[]): Promise<WhoisDSDomain[]> {
  const results: WhoisDSDomain[] = []
  const seen = new Set<string>()

  for (const keyword of keywords.slice(0, 5)) {
    try {
      const url = `https://domaindb.com/search?q=${encodeURIComponent(keyword)}&status=expired`

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0',
          'Accept': 'application/json, text/html'
        },
        signal: AbortSignal.timeout(10000)
      })

      if (!response.ok) continue

      const html = await response.text()
      const regex = /([a-z0-9][a-z0-9\-]{1,61}[a-z0-9]\.[a-z]{2,6})/gi
      let match

      while ((match = regex.exec(html)) !== null) {
        const domain = match[1].toLowerCase()
        if (!seen.has(domain) && !domain.includes('domaindb')) {
          const tld = '.' + domain.split('.').pop()
          if (ALLOWED_TLDS.includes(tld)) {
            seen.add(domain)
            results.push({ domain, source: 'domaindb', matchedKeyword: keyword, discoveredAt: new Date() })
          }
        }
      }

      await new Promise(r => setTimeout(r, 2000))

    } catch (e) {
      console.log(`DomainDB failed for ${keyword}:`, e)
      continue
    }
  }

  console.log(`DomainDB: ${results.length} domains found`)
  return results
}

// ─── SOURCE 5: FreshDrops fallback ────────────────────────────────────────────
async function fetchFreshDropsFallback(keywords: string[]): Promise<WhoisDSDomain[]> {
  try {
    const res = await fetch('https://freshdrops.net/expired-domains/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html'
      },
      signal: AbortSignal.timeout(15000)
    })
    if (!res.ok) return []
    const html = await res.text()
    const matches = Array.from(html.matchAll(/\b([a-z0-9][a-z0-9\-]{1,50}\.(com|net|org|io|co|ai|de))\b/gi))
    const lines = matches.map(m => m[1].toLowerCase())
    const matched = filterRawLines(lines, keywords, 'freshdrops')
    console.log(`FreshDrops: ${matched.length} keyword matches`)
    return matched
  } catch (err) {
    console.warn('FreshDrops failed:', err)
    return []
  }
}

// ─── MAIN EXPORT ──────────────────────────────────────────────────────────────
/**
 * Runs all 5 sources in order. WhoisDS first (bulk). If it fails,
 * runs ExpiredDomains + NameCheap + DomainDB + FreshDrops in parallel.
 */
export async function downloadWhoisDSDrops(keywords: string[]): Promise<WhoisDSDomain[]> {
  // Source 1: WhoisDS bulk file
  const whoisResults = await fetchWhoisDSDrops(keywords)
  if (whoisResults.length > 0) {
    console.log(`WhoisDS primary: ${whoisResults.length} domains`)
    return whoisResults
  }

  console.warn('WhoisDS returned 0 — running all fallback sources in parallel...')

  // Sources 2-5: all in parallel for maximum speed
  const [expiredResults, namecheapResults, domaindbResults, freshdropResults] = await Promise.all([
    scrapeExpiredDomainsReliable(keywords),
    scrapeNamecheapMarket(keywords),
    scrapeDomainDB(keywords),
    fetchFreshDropsFallback(keywords)
  ])

  const all = [...expiredResults, ...namecheapResults, ...domaindbResults, ...freshdropResults]
  const seen = new Set<string>()
  const final: WhoisDSDomain[] = []
  for (const d of all) {
    if (!seen.has(d.domain)) {
      seen.add(d.domain)
      final.push(d)
    }
  }

  console.log(`All sources total: ${final.length} unique domains (expired:${expiredResults.length} namecheap:${namecheapResults.length} domaindb:${domaindbResults.length} freshdrops:${freshdropResults.length})`)
  return final
}
