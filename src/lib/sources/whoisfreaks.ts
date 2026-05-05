// WhoisFreaks Dropped Domain Search API — FREE with 500 credits
// This searches their 100M+ database of dropped domains by keyword

export async function searchDroppedDomains(
  keywords: string[],
  apiKey: string
): Promise<{domain: string, matchedKeyword: string}[]> {
  
  const results: {domain: string, matchedKeyword: string}[] = []
  const seen = new Set<string>()
  
  for (const keyword of keywords.slice(0, 25)) {
    const cleanKw = keyword.toLowerCase().replace(/[\s\-_]/g, '')
    if (cleanKw.length < 2) continue
    
    try {
      // WhoisFreaks dropped domain search — 1 credit per call
      const url = `https://api.whoisfreaks.com/v2.0/domainer/dropped/search?apiKey=${apiKey}&keyword=${encodeURIComponent(cleanKw)}&page=1`
      
      console.log(`WhoisFreaks search: "${cleanKw}" → ${url}`)
      
      const res = await fetch(url, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(15000)
      })
      
      console.log(`WhoisFreaks "${cleanKw}": ${res.status} ${res.headers.get('content-type')}`)
      
      if (!res.ok) {
        const errorText = await res.text()
        console.log(`WhoisFreaks error body: ${errorText.slice(0, 200)}`)
        
        // Try alternative endpoint format
        const altUrl = `https://api.whoisfreaks.com/v2.0/search/dropped?apiKey=${apiKey}&keyword=${encodeURIComponent(cleanKw)}&page=1`
        console.log(`Trying alt URL: ${altUrl}`)
        
        const altRes = await fetch(altUrl, {
          headers: { 'Accept': 'application/json' },
          signal: AbortSignal.timeout(15000)
        })
        
        console.log(`WhoisFreaks alt "${cleanKw}": ${altRes.status}`)
        
        if (!altRes.ok) {
          // Try third format — the web search tool endpoint
          const webUrl = `https://whoisfreaks.com/api/v2.0/domainer/dropped/search?apiKey=${apiKey}&keyword=${encodeURIComponent(cleanKw)}`
          console.log(`Trying web URL: ${webUrl}`)
          
          const webRes = await fetch(webUrl, {
            headers: { 'Accept': 'application/json' },
            signal: AbortSignal.timeout(15000)
          })
          
          console.log(`WhoisFreaks web "${cleanKw}": ${webRes.status}`)
          
          if (!webRes.ok) {
            await new Promise(r => setTimeout(r, 1000))
            continue
          }
          
          const webData = await webRes.json()
          processResults(webData, cleanKw, keyword, seen, results)
          await new Promise(r => setTimeout(r, 1000))
          continue
        }
        
        const altData = await altRes.json()
        processResults(altData, cleanKw, keyword, seen, results)
        await new Promise(r => setTimeout(r, 1000))
        continue
      }
      
      const data = await res.json()
      processResults(data, cleanKw, keyword, seen, results)
      
      // Rate limit: 10 requests per minute on free tier
      await new Promise(r => setTimeout(r, 6500))
      
    } catch (e) {
      console.log(`WhoisFreaks "${cleanKw}" error: ${String(e).slice(0, 100)}`)
    }
  }
  
  console.log(`WhoisFreaks TOTAL: ${results.length} dropped domains found`)
  return results
}

function processResults(
  data: Record<string, unknown>, 
  cleanKw: string, 
  originalKeyword: string,
  seen: Set<string>, 
  results: {domain: string, matchedKeyword: string}[]
) {
  // Handle different response formats
  let domains: Record<string, unknown>[] = []
  
  if (Array.isArray(data)) {
    domains = data
  } else if (data.domains && Array.isArray(data.domains)) {
    domains = data.domains
  } else if (data.result && Array.isArray(data.result)) {
    domains = data.result
  } else if (data.data && Array.isArray(data.data)) {
    domains = data.data
  } else if (data.domain_list && Array.isArray(data.domain_list)) {
    domains = data.domain_list
  }
  
  console.log(`WhoisFreaks "${cleanKw}": ${domains.length} domains in response`)
  
  for (const item of domains) {
    const raw = item as Record<string, string>;
    const domain = (typeof item === 'string' ? item : raw.domain || raw.domainName || raw.domain_name || '').toLowerCase().trim()
    
    if (!domain || !domain.includes('.') || seen.has(domain)) continue
    
    // Skip junk TLDs
    const tld = '.' + domain.split('.').slice(1).join('.')
    const junkTLDs = ['.xyz', '.top', '.click', '.store', '.site', '.online', '.live', '.club', '.buzz', '.icu', '.space', '.fun']
    if (junkTLDs.includes(tld)) continue
    
    // Skip too long
    if (domain.length > 40) continue
    
    seen.add(domain)
    results.push({ domain, matchedKeyword: originalKeyword })
  }
}
