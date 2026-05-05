export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { downloadDailyDrops, filterByNicheKeywords } from "@/lib/pipeline/volume-engine";
import { IPTV_DOMAIN_PATTERNS } from "@/lib/iptv/keyword-database";

export async function POST(req: Request) {
  try {
    const { markets } = await req.json();
    const marketList = markets && markets.length > 0 ? markets : ['US'];
    
    // Load WhoisFreaks key
    const settings = await prisma.settings.findMany();
    const whoisfreaksKey = settings.find(s => s.key === 'whoisfreaksApiKey')?.value || '';
    
    if (!whoisfreaksKey) {
      return NextResponse.json({ error: "WhoisFreaks API key not configured" }, { status: 400 });
    }
    
    // Step 1: Download drops from WhoisFreaks
    const allDrops = await downloadDailyDrops(whoisfreaksKey);
    
    // Step 2: Filter by IPTV keywords
    const iptvKeywords = IPTV_DOMAIN_PATTERNS.slice(0, 30);
    const iptvNiche = { slug: 'iptv_players', keywords: iptvKeywords, tlds: [] as string[] };
    const matches = filterByNicheKeywords(allDrops, [iptvNiche]);
    
    // Step 3: Score matches
    const results = matches.slice(0, 20).map(m => {
      // Basic scoring for IPTV domains
      const name = m.domain.split('.')[0];
      let score = 30; // base
      if (name.includes('iptv')) score += 20;
      if (name.includes('stream')) score += 15;
      if (name.includes('tv')) score += 10;
      if (name.includes('live')) score += 10;
      if (name.length < 15) score += 10;
      const tld = '.' + m.domain.split('.').slice(1).join('.');
      if (['.com', '.net', '.org', '.tv'].includes(tld)) score += 5;
      score = Math.min(100, score);
      
      return {
        domain: m.domain,
        iptvScore: score,
        parasiteReadiness: score >= 70 ? 'HIGH' : score >= 45 ? 'MEDIUM' : 'LOW',
        estimatedRankDays: Math.max(7, 90 - score),
        googlePages: 0,
        estimatedMonthlyRevenue: Math.round(score * 3.5),
        previouslyIPTV: name.includes('iptv') || name.includes('stream'),
        market: marketList[0],
      };
    });

    return NextResponse.json({
      scanned: allDrops.length,
      filtered: matches.length,
      passed: results.length,
      results: results.sort((a, b) => b.iptvScore - a.iptvScore)
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to scan" }, { status: 500 });
  }
}
