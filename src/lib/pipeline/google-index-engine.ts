// Checks if Google still has the domain indexed
// Uses DataForSEO SERP API for reliable results (no IP blocking)
// Cost: $0.002 per check

export async function checkGoogleIndex(
  domain: string,
  dataForSeoEmail: string,
  dataForSeoPassword: string
): Promise<{ indexed: boolean, pageCount: number }> {
  
  try {
    const auth = Buffer.from(`${dataForSeoEmail}:${dataForSeoPassword}`).toString('base64')
    
    const res = await fetch(
      'https://api.dataforseo.com/v3/serp/google/organic/live/advanced',
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify([{
          keyword: `site:${domain}`,
          location_code: 2840,
          language_code: 'en',
          depth: 10
        }]),
        signal: AbortSignal.timeout(10000)
      }
    )
    
    if (!res.ok) return { indexed: false, pageCount: 0 }
    
    const data = await res.json()
    const totalCount = data?.tasks?.[0]?.result?.[0]?.items_count || 0
    
    console.log(`[INDEX] ${domain}: ${totalCount > 0 ? '✅' : '❌'} ${totalCount} pages indexed`)
    
    return { indexed: totalCount > 0, pageCount: totalCount }
    
  } catch {
    return { indexed: false, pageCount: 0 }
  }
}

// Batch check — only check top scoring domains to save API credits
export async function batchCheckGoogleIndex(
  domains: string[],
  email: string,
  password: string
): Promise<Map<string, { indexed: boolean, pageCount: number }>> {
  
  const results = new Map<string, { indexed: boolean, pageCount: number }>()
  
  for (const domain of domains) {
    const result = await checkGoogleIndex(domain, email, password)
    results.set(domain, result)
    await new Promise(r => setTimeout(r, 300))
  }
  
  const indexed = Array.from(results.values()).filter(r => r.indexed).length
  console.log(`[INDEX] ${indexed}/${results.size} domains are Google indexed`)
  
  return results
}
