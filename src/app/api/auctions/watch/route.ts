import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { domain, listingId, currentBid, maxBid, bidCount, hoursRemaining, opportunityScore } = body;

    await prisma.auctionWatch.upsert({
      where: { listingId },
      create: { domain, listingId, currentBid, maxBid, bidCount, hoursRemaining, opportunityScore, status: "WATCHING" },
      update: { currentBid, maxBid, bidCount, hoursRemaining },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
