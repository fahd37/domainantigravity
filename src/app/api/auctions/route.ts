export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { filterDomain } from '@/lib/filter';
import { scoreAuctionOpportunity } from '@/lib/auction-scorer';

export async function GET() {
  try {
    const niches = await prisma.niche.findMany({ where: { active: true } }).catch(() => []);

    // GoDaddy scraper removed — auctions now powered by drop-feed pipeline
    const gdAuctions: { domain: string; currentBid: number; bidCount: number; hoursRemaining: number; endTime: string; listingId: string }[] = [];

    // ── Source 2: WhoisFreaks dropped domains from DB (always populated by scan)
    const dbDomains = await prisma.domain.findMany({
      where: { status: { in: ['PENDING', 'QUEUED'] } },
      orderBy: [{ score: 'desc' }, { createdAt: 'desc' }],
      take: 100,
    }).catch(() => []);

    // Convert DB domains into auction-like objects for unified display
    const dbAuctions = dbDomains.map((d, i) => ({
      domain: d.name,
      currentBid: Math.max(10, Math.round((d.score ?? 0) * 0.8 + 8)),
      bidCount: 0,
      hoursRemaining: 24 + (i % 3) * 12, // staggered 24/36/48h
      endTime: new Date(Date.now() + (24 + (i % 3) * 12) * 3600000).toISOString(),
      listingId: `db-${d.id}`,
      source: 'whoisfreaks-drop' as const,
      niche: d.niche ?? undefined,
      domainScore: d.score ?? 0,
    }));

    // Merge: real GoDaddy first, then DB drops
    const allRaw = [...gdAuctions.map(a => ({ ...a, source: 'godaddy-auction' as const, niche: undefined, domainScore: 0 })), ...dbAuctions];
    const seen = new Set<string>();

    const enriched = allRaw
      .filter(a => { if (seen.has(a.domain)) return false; seen.add(a.domain); return true; })
      .map(a => {
        const nicheMatch = filterDomain(a.domain, niches);
        const opportunity = scoreAuctionOpportunity(a, a.domainScore, 500);
        return {
          ...a,
          niche: a.niche ?? nicheMatch.matchedNiche ?? null,
          nicheMatch: nicheMatch.passes,
          opportunityScore: opportunity.opportunityScore,
          maxBid: opportunity.maxBid,
          reason: opportunity.reason,
          domainScore: a.domainScore || 0,
        };
      })
      .sort((a, b) => b.opportunityScore - a.opportunityScore);

    const watched = await prisma.auctionWatch.findMany({
      where: { status: 'WATCHING' },
      orderBy: { opportunityScore: 'desc' },
    }).catch(() => []);

    return NextResponse.json({
      auctions: enriched,
      watched,
      meta: {
        godaddyCount: gdAuctions.length,
        dbCount: dbAuctions.length,
        total: enriched.length,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
