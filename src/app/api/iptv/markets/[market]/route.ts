import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request, { params }: { params: { market: string } }) {
  try {
    const market = params.market.toUpperCase();
    const data = await prisma.iPTVMarketAnalysis.findUnique({
      where: { market }
    });
    
    if (!data) {
      return NextResponse.json({ error: "Market not found" }, { status: 404 });
    }
    
    return NextResponse.json({ data });
  } catch (error) {
    console.error("Failed to fetch market data:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
