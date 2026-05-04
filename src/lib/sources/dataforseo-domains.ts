export interface DataForSEOResult {
  domain: string
  createdDate: string | null
  expirationDate: string | null
  registered: boolean
  ageYears: number
  organicKeywords: number
  organicTraffic: number
  organicPositions1: number
  organicPositions2_3: number
  referringDomains: number
  backlinks: number
}

export async function scoreDomainsWithDataForSEO(
  domains: string[],
  email: string,
  password: string
): Promise<Map<string, DataForSEOResult>> {
  
  const results = new Map<string, DataForSEOResult>()
  const auth = Buffer.from(`${email}:${password}`).toString('base64')
  
  // Process in batches of 50
  const batches: string[][] = []
  for (let i = 0; i < domains.length; i += 50) {
    batches.push(domains.slice(i, i + 50))
  }
  
  for (const batch of batches.slice(0, 4)) { // Max 4 batches = 200 domains per scan
    for (const domain of batch) {
      try {
        const res = await fetch(
          'https://api.dataforseo.com/v3/domain_analytics/whois/overview/live',
          {
            method: 'POST',
            headers: {
              'Authorization': `Basic ${auth}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify([{
              limit: 1,
              filters: [
                ["domain", "=", domain]
              ]
            }]),
            signal: AbortSignal.timeout(10000)
          }
        )
        
        if (!res.ok) {
          console.log(`DataForSEO ${domain}: ${res.status}`)
          continue
        }
        
        const data = await res.json()
        const item = data?.tasks?.[0]?.result?.[0]?.items?.[0]
        
        if (item) {
          results.set(domain, {
            domain: item.domain,
            createdDate: item.created_datetime || null,
            expirationDate: item.expiration_datetime || null,
            registered: item.registered ?? true,
            ageYears: item.created_datetime 
              ? Math.floor((Date.now() - new Date(item.created_datetime).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
              : 0,
            organicKeywords: item.metrics?.organic?.count || 0,
            organicTraffic: item.metrics?.organic?.etv || 0,
            organicPositions1: item.metrics?.organic?.pos_1 || 0,
            organicPositions2_3: item.metrics?.organic?.pos_2_3 || 0,
            referringDomains: item.backlinks_info?.referring_domains || 0,
            backlinks: item.backlinks_info?.backlinks || 0,
          })
          
          console.log(`DataForSEO ${domain}: keywords=${item.metrics?.organic?.count || 0} traffic=$${item.metrics?.organic?.etv || 0} links=${item.backlinks_info?.referring_domains || 0}`)
        }
        
        // Small delay between calls
        await new Promise(r => setTimeout(r, 200))
        
      } catch (e) {
        console.log(`DataForSEO ${domain}: ${String(e).slice(0, 60)}`)
      }
    }
    
    // Delay between batches
    await new Promise(r => setTimeout(r, 1000))
  }
  
  console.log(`DataForSEO: scored ${results.size} out of ${domains.length} domains`)
  return results
}
