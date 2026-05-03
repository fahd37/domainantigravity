export const runtime = 'nodejs';
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const market = searchParams.get('market');
    const language = searchParams.get('language');
    const category = searchParams.get('category');
    const moneyOnly = searchParams.get('moneyOnly');

    const where: Record<string, string | boolean> = {};
    if (market) where.market = market;
    if (language) where.language = language;
    if (category) where.category = category;
    if (moneyOnly === 'true') where.isMoneyKw = true;

    const keywords = await prisma.iPTVKeywordDatabase.findMany({
      where,
      orderBy: { searchVolume: 'desc' },
      take: 50
    });

    const withOpportunity = keywords.map(kw => ({
      ...kw,
      opportunityScore: (kw.searchVolume / 1000) / kw.difficulty * kw.cpc
    })).sort((a, b) => b.opportunityScore - a.opportunityScore);

    return NextResponse.json({ keywords: withOpportunity });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to load keywords" }, { status: 500 });
  }
}
