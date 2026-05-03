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

export async function GET() {
  try {
    const niches = await prisma.nicheIntelligence.findMany()
    const withScore = niches
      .map(n => ({ ...n, opportunityScore: computeOpportunityScore(n) }))
      .sort((a, b) => b.opportunityScore - a.opportunityScore)

    return NextResponse.json({ niches: withScore })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
