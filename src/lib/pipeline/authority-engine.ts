// Scores domains with real SEO data from DataForSEO
// Gets: traffic value, keyword count, ranking positions, referring domains, age
// Cost: $0.10 per domain

export interface DomainScore {
  domain: string
  niche: string
  matchedKeyword: string
  score: number
  traffic: number
  keywords: number
  referringDomains: number
  backlinks: number
  age: number
  createdDate: string | null
  positions1: number
  positions2_3: number
}

export async function scoreDomains(
  domains: { domain: string, niche: string, matchedKeyword: string }[],
  email: string,
  password: string,
  maxToScore: number = 50
): Promise<DomainScore[]> {
  
  const scored: DomainScore[] = []
  const auth = Buffer.from(`${email}:${password}`).toString('base64')
  const toScore = domains.slice(0, maxToScore)
  
  console.log(`[AUTHORITY] Scoring ${toScore.length} domains with DataForSEO...`)
  
  for (const item of toScore) {
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
            filters: [["domain", "=", item.domain]]
          }]),
          signal: AbortSignal.timeout(10000)
        }
      )
      
      if (!res.ok) {
        console.log(`[AUTHORITY] ${item.domain}: HTTP ${res.status}`)
        continue
      }
      
      const data = await res.json()
      const result = data?.tasks?.[0]?.result?.[0]?.items?.[0]
      
      if (result) {
        const traffic = result.metrics?.organic?.etv || 0
        const keywords = result.metrics?.organic?.count || 0
        const refs = result.backlinks_info?.referring_domains || 0
        const backlinks = result.backlinks_info?.backlinks || 0
        const created = result.created_datetime || null
        const pos1 = result.metrics?.organic?.pos_1 || 0
        const pos2_3 = result.metrics?.organic?.pos_2_3 || 0
        const age = created 
          ? Math.floor((Date.now() - new Date(created).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) 
          : 0
        
        // Calculate parasite SEO score
        let score = 0
        score += Math.min(35, (traffic / 50) * 5)        // traffic: max 35
        score += Math.min(25, keywords * 0.4)              // keywords: max 25
        score += Math.min(20, refs * 0.4)                  // refs: max 20
        score += Math.min(10, age * 1.5)                   // age: max 10
        score += Math.min(10, (pos1 * 5) + (pos2_3 * 2))  // top positions: max 10
        
        score = Math.round(score)
        
        if (score > 0) {
          console.log(`[AUTHORITY] ${item.domain}: ${score}pts (traffic=$${traffic}, kw=${keywords}, refs=${refs}, age=${age}yr, pos1=${pos1})`)
        }
        
        scored.push({
          ...item,
          score,
          traffic,
          keywords,
          referringDomains: refs,
          backlinks,
          age,
          createdDate: created,
          positions1: pos1,
          positions2_3: pos2_3
        })
      }
      
      await new Promise(r => setTimeout(r, 250))
      
    } catch (e) {
      console.log(`[AUTHORITY] ${item.domain}: ${String(e).slice(0, 60)}`)
    }
  }
  
  // Sort by score descending
  scored.sort((a, b) => b.score - a.score)
  
  console.log(`[AUTHORITY] Scored ${scored.length} domains. Top: ${scored[0]?.domain} (${scored[0]?.score}pts)`)
  return scored
}
