export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Cron: auction monitoring — now powered by drop-feed pipeline domains
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { scoreAuctionOpportunity } from "@/lib/auction-scorer";

export async function GET(request: Request) {
  if (request.headers.get("x-cron-secret") !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get high-scoring domains from DB (populated by drop-feed pipeline)
    const dbDomains = await prisma.domain.findMany({
      where: { status: { in: ['PENDING', 'QUEUED'] }, score: { gte: 30 } },
      orderBy: { score: 'desc' },
      take: 50,
    });

    let watched = 0;

    for (const d of dbDomains) {
      try {
        const auction = {
          domain: d.name,
          currentBid: Math.max(10, Math.round((d.score ?? 0) * 0.8 + 8)),
          bidCount: 0,
          hoursRemaining: 24,
          endTime: new Date(Date.now() + 24 * 3600000).toISOString(),
          listingId: `db-${d.id}`,
        };
        const opportunity = scoreAuctionOpportunity(auction, d.score ?? 0, 50);

        if (opportunity.opportunityScore < 40) continue;

        const existing = await prisma.auctionWatch.findFirst({ where: { listingId: auction.listingId } });

        if (!existing) {
          await prisma.auctionWatch.create({
            data: {
              domain: d.name,
              listingId: auction.listingId,
              currentBid: auction.currentBid,
              maxBid: opportunity.maxBid,
              bidCount: 0,
              hoursRemaining: 24,
              opportunityScore: opportunity.opportunityScore,
              status: "WATCHING",
            },
          });
          watched++;
        }
      } catch (err) {
        console.error(`[Cron/auctions] ${d.name}: ${err}`);
      }
    }

    return NextResponse.json({
      success: true,
      domainsChecked: dbDomains.length,
      watched,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Cron/auctions] Error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
