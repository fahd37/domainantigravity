export const dynamic = 'force-dynamic'
import { downloadWhoisDSDrops } from "@/lib/sources/whoisds"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

export async function GET() {
  const niches = await prisma.niche.findMany({ where: { active: true } })
  const keywords = niches.flatMap(n => n.keywords).slice(0, 20)
  
  const domains = await downloadWhoisDSDrops(keywords)
  
  return NextResponse.json({
    success: true,
    keywordsUsed: keywords.length,
    domainsFound: domains.length,
    sample: domains.slice(0, 20),
    breakdown: {
      byKeyword: keywords.map(kw => ({
        keyword: kw,
        count: domains.filter(d => d.matchedKeyword === kw).length
      })).filter(k => k.count > 0)
    }
  })
}
