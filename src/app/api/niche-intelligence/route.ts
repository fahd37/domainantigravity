export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
export const dynamic = 'force-dynamic';

function computeOpportunityScore(n: {
  avgCompetitionScore: number; parasiteSuccessRate: number;
  expiredDomainsAvailable: number; indexationRate: number;
}) {
  return Math.round(
    (100 - n.avgCompetitionScore) * 0.3 +
    n.parasiteSuccessRate * 0.3 +
    Math.min(100, n.expiredDomainsAvailable / 20) * 0.2 +
    n.indexationRate * 0.2
  );
}

export async function GET() {
  try {
    const [niches, allDomains] = await Promise.all([
      prisma.nicheIntelligence.findMany(),
      prisma.domain.findMany({
        select: { niche: true, score: true, status: true, googleIndexed: true, createdAt: true },
      }).catch(() => []),
    ]);

    // Group real DB domains by niche for enrichment
    const byNiche: Record<string, typeof allDomains> = {};
    for (const d of allDomains) {
      const key = d.niche?.toLowerCase().replace(/\s+/g, '_') ?? 'unknown';
      if (!byNiche[key]) byNiche[key] = [];
      byNiche[key].push(d);
    }

    const totalScanned = allDomains.length;
    const totalIndexed = allDomains.filter(d => d.googleIndexed).length;

    const withScore = niches.map(n => {
      const realDomains = byNiche[n.slug] ?? [];
      const realAvgScore = realDomains.length
        ? Math.round(realDomains.reduce((s, d) => s + (d.score ?? 0), 0) / realDomains.length)
        : null;
      const realIndexedCount = realDomains.filter(d => d.googleIndexed).length;
      const realScannedCount = realDomains.length;
      const boughtCount = realDomains.filter(d => d.status === 'BOUGHT').length;

      return {
        ...n,
        opportunityScore: computeOpportunityScore(n),
        realScannedCount,
        realIndexedCount,
        realAvgScore,
        boughtCount,
      };
    }).sort((a, b) => b.opportunityScore - a.opportunityScore);

    return NextResponse.json({
      niches: withScore,
      meta: { totalScanned, totalIndexed, totalNiches: niches.length },
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
