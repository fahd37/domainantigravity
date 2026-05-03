export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const indexedDomains = await prisma.domain.count({
      where: { googleIndexed: true }
    });
    
    // Average parasite score of indexed domains
    const indexed = await prisma.domain.findMany({
      where: { googleIndexed: true },
      select: { parasiteScore: true, historicalKeywords: true }
    });
    
    let totalScore = 0;
    let totalKeywords = 0;
    indexed.forEach(d => {
      totalScore += d.parasiteScore || 0;
      // parse JSON array if needed, prisma should handle JSON arrays 
      if (Array.isArray(d.historicalKeywords)) {
        totalKeywords += d.historicalKeywords.length;
      }
    });
    const avgParasiteScore = indexed.length > 0 ? Math.round(totalScore / indexed.length) : 0;

    const highReadiness = await prisma.domain.count({
      where: { parasiteReadiness: 'HIGH' }
    });

    // WhoisDS status from last ScanRun
    const lastScan = await prisma.scanRun.findFirst({
      where: { source: { contains: 'whoisds' }, status: 'COMPLETED' },
      orderBy: { startedAt: 'desc' }
    });

    const whoisdsStatus = {
      lastDownload: lastScan?.startedAt || null,
      domainsLoaded: lastScan?.domainsPassed || 0,
      nextRetry: lastScan?.startedAt 
        ? new Date(new Date(lastScan.startedAt).getTime() + 6 * 3600 * 1000) 
        : new Date()
    };

    return NextResponse.json({
      indexedDomains,
      avgParasiteScore,
      highReadiness,
      keywordsIdentified: totalKeywords,
      whoisdsStatus
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
