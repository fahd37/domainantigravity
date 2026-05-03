export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const allDomains = await prisma.domain.findMany();
    
    // Summary
    const totalScanned = allDomains.length;
    const avgScore = totalScanned > 0 
      ? allDomains.reduce((acc, d) => acc + (d.score || 0), 0) / totalScanned 
      : 0;
    
    const boughtDomains = allDomains.filter(d => d.status === "BOUGHT");
    const buyRate = totalScanned > 0 ? (boughtDomains.length / totalScanned) * 100 : 0;
    const totalSpent = boughtDomains.reduce((acc, d) => acc + (d.price || 10), 0);

    // Chart 1: velocity (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentDomains = allDomains.filter(d => new Date(d.createdAt) > thirtyDaysAgo);
    
    const velocityMap: Record<string, number> = {};
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      velocityMap[d.toISOString().split('T')[0]] = 0;
    }
    
    recentDomains.forEach(d => {
      const date = new Date(d.createdAt).toISOString().split('T')[0];
      if (velocityMap[date] !== undefined) {
        velocityMap[date]++;
      }
    });
    const velocity = Object.keys(velocityMap).map(date => ({ date, count: velocityMap[date] }));

    // Chart 2: score distribution
    const buckets = { "0-20": 0, "21-40": 0, "41-60": 0, "61-80": 0, "81-100": 0 };
    allDomains.forEach(d => {
      const s = d.score || 0;
      if (s <= 20) buckets["0-20"]++;
      else if (s <= 40) buckets["21-40"]++;
      else if (s <= 60) buckets["41-60"]++;
      else if (s <= 80) buckets["61-80"]++;
      else buckets["81-100"]++;
    });
    const scoreDistribution = Object.keys(buckets).map(range => ({ range, count: buckets[range as keyof typeof buckets] }));

    // Chart 3: Niche
    const nicheMap: Record<string, number> = {};
    allDomains.forEach(d => {
      const n = d.niche || "unknown";
      nicheMap[n] = (nicheMap[n] || 0) + 1;
    });
    const nicheDistribution = Object.keys(nicheMap).map(niche => ({ niche, count: nicheMap[niche] }));

    // Chart 4: Rejections
    const rejectionMap: Record<string, number> = {};
    allDomains.forEach(d => {
      if (d.filterReason) {
        rejectionMap[d.filterReason] = (rejectionMap[d.filterReason] || 0) + 1;
      }
    });
    const rejectionReasons = Object.keys(rejectionMap)
      .map(reason => ({ reason: reason.substring(0, 30) + (reason.length > 30 ? "..." : ""), count: rejectionMap[reason] }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return NextResponse.json({
      summary: { totalScanned, avgScore: avgScore.toFixed(1), buyRate: buyRate.toFixed(1), totalSpent },
      velocity,
      scoreDistribution,
      nicheDistribution,
      rejectionReasons
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
