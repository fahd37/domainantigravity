import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { filterDomain } from "@/lib/filter";
import { checkWayback } from "@/lib/wayback";
import { getMajesticMetrics } from "@/lib/majestic";
import { scoreDomaain } from "@/lib/scorer";
import { scoreAuctionOpportunity } from "@/lib/auction-scorer";
import { scrapeGoDaddyAuctions } from "@/lib/sources/godaddy-auctions";

export async function GET() {
  try {
    const niches = await prisma.niche.findMany({ where: { active: true } }).catch(() => []);
    const keywords = niches.flatMap(n => n.keywords).slice(0, 5);
    
    const auctions = await scrapeGoDaddyAuctions(keywords.length ? keywords : ["seo", "marketing", "tech"]);
    
    const enriched = await Promise.all(
      auctions.map(async (auction) => {
        const nicheMatch = filterDomain(auction.domain, niches);
        const waybackResult = await checkWayback(auction.domain);
        const majesticResult = await getMajesticMetrics(auction.domain);
        const scoreResult = scoreDomaain(
          auction.domain,
          waybackResult,
          { referringDomains: 0, backlinks: 0, domainScore: 0, spamScore: 0, ageYears: 0 },
          nicheMatch,
          55,
          majesticResult
        );
        const opportunity = scoreAuctionOpportunity(auction, scoreResult.total);
        return { ...auction, domainScore: scoreResult.total, ...opportunity };
      })
    );

    // Merge with watched auctions from DB
    const watched = await prisma.auctionWatch.findMany({
      where: { status: "WATCHING" },
      orderBy: { opportunityScore: "desc" },
    });

    return NextResponse.json({ auctions: enriched, watched });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
