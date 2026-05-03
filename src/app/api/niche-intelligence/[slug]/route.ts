export const runtime = 'nodejs';
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

function computeOpportunityScore(n: {
  avgCompetitionScore: number
  parasiteSuccessRate: number
  expiredDomainsAvailable: number
  indexationRate: number
}) {
  return (
    (100 - n.avgCompetitionScore) * 0.3 +
    n.parasiteSuccessRate * 0.3 +
    (n.expiredDomainsAvailable / 20) * 0.2 +
    n.indexationRate * 0.2
  )
}

export async function GET(_req: Request, { params }: { params: { slug: string } }) {
  try {
    const niche = await prisma.nicheIntelligence.findUnique({ where: { slug: params.slug } })
    if (!niche) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ niche: { ...niche, opportunityScore: computeOpportunityScore(niche) } })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
