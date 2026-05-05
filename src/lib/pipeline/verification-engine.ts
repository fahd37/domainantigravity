// Bulk checks if filtered domains are actually available to register
// Uses Namecheap API — FREE (you only pay when buying)
// Falls back to WhoisFreaks availability check if Namecheap not configured

export async function verifyAvailability(
  domains: { domain: string, niche: string, matchedKeyword: string }[],
  namecheapUser?: string,
  namecheapKey?: string,
  whoisfreaksKey?: string
): Promise<{ domain: string, niche: string, matchedKeyword: string, available: boolean, price?: number }[]> {
  
  const verified: { domain: string, niche: string, matchedKeyword: string, available: boolean, price?: number }[] = []
  
  if (namecheapUser && namecheapKey) {
    console.log(`[VERIFY] Using Namecheap API for ${domains.length} domains`)
    
    // Namecheap checks up to 50 domains per request
    for (let i = 0; i < domains.length; i += 50) {
      const batch = domains.slice(i, i + 50)
      const domainList = batch.map(d => d.domain).join(',')
      
      try {
        const url = `https://api.namecheap.com/xml.response?ApiUser=${namecheapUser}&ApiKey=${namecheapKey}&UserName=${namecheapUser}&Command=namecheap.domains.check&ClientIp=127.0.0.1&DomainList=${domainList}`
        
        const res = await fetch(url, { signal: AbortSignal.timeout(15000) })
        const xml = await res.text()
        
        for (const item of batch) {
          // Check if domain is available in XML response
          const regex = new RegExp(`Domain="${item.domain.replace(/\./g, '\\.')}"[^>]*Available="(true|false)"`, 'i')
          const match = xml.match(regex)
          
          if (match && match[1].toLowerCase() === 'true') {
            console.log(`[VERIFY] ✅ ${item.domain} — AVAILABLE`)
            verified.push({ ...item, available: true })
          }
        }
        
        await new Promise(r => setTimeout(r, 1000))
        
      } catch (e) {
        console.log(`[VERIFY] Namecheap batch error: ${String(e).slice(0, 80)}`)
      }
    }
    
  } else if (whoisfreaksKey) {
    console.log(`[VERIFY] Using WhoisFreaks availability API for ${Math.min(domains.length, 50)} domains`)
    
    for (const item of domains.slice(0, 50)) {
      try {
        const res = await fetch(
          `https://api.whoisfreaks.com/v2.0/whois/live?apiKey=${whoisfreaksKey}&domainName=${item.domain}&format=json`,
          { signal: AbortSignal.timeout(8000) }
        )
        
        if (res.ok) {
          const data = await res.json()
          // If WHOIS returns no registrant/empty = likely available
          if (!data.registrant || data.status === 'available' || data.domain_registered === 'no') {
            console.log(`[VERIFY] ✅ ${item.domain} — AVAILABLE`)
            verified.push({ ...item, available: true })
          }
        }
        
        await new Promise(r => setTimeout(r, 6500)) // rate limit
        
      } catch (e) {
        console.log(`[VERIFY] ${item.domain}: ${String(e).slice(0, 50)}`)
      }
    }
    
  } else {
    // No verification API — pass all through (will verify at purchase time)
    console.log(`[VERIFY] No verification API configured — passing all domains through`)
    return domains.map(d => ({ ...d, available: true }))
  }
  
  console.log(`[VERIFY] ${verified.length} domains confirmed available out of ${domains.length}`)
  return verified
}
