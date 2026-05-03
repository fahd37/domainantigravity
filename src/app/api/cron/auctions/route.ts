// Cron: every 30 min — scrapes GoDaddy auctions, scores, watches, sniper bids
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { filterDomain } from "@/lib/filter";
import { checkWayback } from "@/lib/wayback";
import { getMajesticMetrics } from "@/lib/majestic";
import { scoreDomaain } from "@/lib/scorer";
import { checkGoogleIndex } from "@/lib/google-index";
import { scoreAuctionOpportunity } from "@/lib/auction-scorer";
import { placeBid } from "@/lib/godaddy-bidder";
import crypto from "crypto";

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || "12345678901234567890123456789012";
function decrypt(text: string) {
  try {
    if (!text.includes(":")) return text;
    const parts = text.split(":");
    const iv = Buffer.from(parts.shift()!, "hex");
    const enc = Buffer.from(parts.join(":"), "hex");
    const d = crypto.createDecipheriv("aes-256-cbc", Buffer.from(ENCRYPTION_KEY), iv);
    return Buffer.concat([d.update(enc), d.final()]).toString();
  } catch { return text; }
}

export async function GET(request: Request) {
  if (request.headers.get("x-cron-secret") !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const settingsRows = await prisma.settings.findMany();
    const settings = settingsRows.reduce((acc, r) => { acc[r.key] = decrypt(r.value); return acc; }, {} as Record<string, string>);
    const gdApiKey = settings["gd_api_key"];
    const gdApiSecret = settings["gd_api_secret"];
    const buyThreshold = parseInt(settings["buy_threshold"] || "55");
    const maxPrice = parseFloat(settings["max_price"] || "50");

    // Get keywords from active niches
    const niches = await prisma.niche.findMany({ where: { active: true } });
    const keywords = niches.flatMap(n => n.keywords).slice(0, 8);

    if (keywords.length === 0) {
      return NextResponse.json({ success: true, message: "No active niches to scan" });
    }

    const { scrapeGoDaddyAuctions } = await import("@/lib/sources/godaddy-auctions");
    const auctions = await scrapeGoDaddyAuctions(keywords);

    let watched = 0;
    let sniped = 0;
    const errors: string[] = [];

    for (const auction of auctions) {
      try {
        // Score domain through full pipeline
        const nicheMatch = filterDomain(auction.domain, niches);
        const waybackResult = await checkWayback(auction.domain);
        const googleIndexResult = await checkGoogleIndex(auction.domain);
        const majesticResult = await getMajesticMetrics(auction.domain, settings["majestic_key"] || "free");
        const scoreResult = scoreDomaain(auction.domain, waybackResult, { referringDomains: 0, backlinks: 0, domainScore: 0, spamScore: 0, ageYears: 0 }, nicheMatch, buyThreshold, majesticResult, undefined, undefined, googleIndexResult);

        const opportunity = scoreAuctionOpportunity(auction, scoreResult.total, maxPrice);

        if (opportunity.opportunityScore < 40) continue; // not interesting

        // Upsert into AuctionWatch
        const existing = await prisma.auctionWatch.findFirst({ where: { listingId: auction.listingId } });

        if (!existing) {
          await prisma.auctionWatch.create({
            data: {
              domain: auction.domain,
              listingId: auction.listingId,
              currentBid: auction.currentBid,
              maxBid: opportunity.maxBid,
              bidCount: auction.bidCount,
              hoursRemaining: auction.hoursRemaining,
              opportunityScore: opportunity.opportunityScore,
              status: "WATCHING",
            },
          });
          watched++;
        } else {
          await prisma.auctionWatch.update({
            where: { id: existing.id },
            data: { currentBid: auction.currentBid, bidCount: auction.bidCount, hoursRemaining: auction.hoursRemaining },
          });
        }

        // Sniper: bid in final window if creds available
        if (gdApiKey && gdApiSecret && auction.hoursRemaining < 2 && auction.hoursRemaining > 0 && auction.currentBid < opportunity.maxBid) {
          const bidAmount = auction.currentBid + 1;
          const result = await placeBid(auction.listingId, bidAmount, gdApiKey, gdApiSecret);
          if (result.success) {
            await prisma.auctionWatch.update({
              where: { listingId: auction.listingId },
              data: { status: "WATCHING", placedBidAt: new Date(), currentBid: bidAmount },
            });
            sniped++;
          }
        }
      } catch (err) {
        errors.push(`${auction.domain}: ${err}`);
      }
    }

    return NextResponse.json({
      success: true,
      auctionsFound: auctions.length,
      watched,
      sniped,
      errors: errors.slice(0, 5),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Cron/auctions] Error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
