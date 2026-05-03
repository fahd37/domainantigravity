import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
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

export async function POST(req: Request) {
  try {
    const { listingId, bidAmount } = await req.json();

    const settingsRows = await prisma.settings.findMany();
    const settings = settingsRows.reduce((acc, r) => { acc[r.key] = decrypt(r.value); return acc; }, {} as Record<string, string>);

    const apiKey = settings["gd_api_key"];
    const apiSecret = settings["gd_api_secret"];

    if (!apiKey || !apiSecret) {
      return NextResponse.json({ success: false, error: "GoDaddy API credentials not configured. Add them in Settings." }, { status: 400 });
    }

    const result = await placeBid(listingId, bidAmount, apiKey, apiSecret);

    if (result.success) {
      await prisma.auctionWatch.update({
        where: { listingId },
        data: { placedBidAt: new Date(), currentBid: result.newBid ?? bidAmount },
      }).catch(console.error);
    }

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
