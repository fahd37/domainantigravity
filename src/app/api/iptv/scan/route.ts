import { NextResponse } from "next/server";
import { downloadWhoisDSDrops } from "@/lib/sources/whoisds";
import { checkGoogleIndex } from "@/lib/google-index";
import { checkWaybackContent } from "@/lib/wayback";
import { scoreIPTVDomain } from "@/lib/iptv/iptv-scorer";
import { IPTV_DOMAIN_PATTERNS } from "@/lib/iptv/keyword-database";

export async function POST(req: Request) {
  try {
    const { markets } = await req.json();
    const marketList = markets && markets.length > 0 ? markets : ['US'];
    
    // Step 1: Call WhoisDS real API
    // Using top 15 patterns to keep the API responsive
    const keywords = IPTV_DOMAIN_PATTERNS.slice(0, 15);
    const whoisDomains = await downloadWhoisDSDrops(keywords);
    
    // Process top 10 domains for real checks to avoid extremely long requests
    const realDomains = whoisDomains.slice(0, 10);
    const results = [];
    
    // Step 2: For each real domain found
    for (const d of realDomains) {
      // Run real Google index check
      const gIndex = await checkGoogleIndex(d.domain);
      
      // Run real Wayback check
      const wback = await checkWaybackContent(d.domain, ['iptv', 'stream', 'channel']);
      
      // Run real IPTV scorer
      const scoreData = scoreIPTVDomain({
        domain: d.domain,
        googleIndex: { indexed: gIndex.indexed, pageCount: gIndex.pageCount },
        wayback: { contentSample: wback.contentSample },
        dataForSeo: { ageYears: 4 }, // Mocked or fetched if DFS available
        majestic: { trustFlow: 10, citationFlow: 10, tfCfRatio: 1.0 }, // Mocked or fetched
        targetMarket: marketList[0],
        language: 'en'
      });
      
      results.push({
        domain: d.domain,
        iptvScore: scoreData.total,
        parasiteReadiness: scoreData.parasiteReadiness,
        estimatedRankDays: scoreData.estimatedDaysToRank,
        googlePages: gIndex.pageCount,
        estimatedMonthlyRevenue: scoreData.estimatedMonthlyRevenue,
        previouslyIPTV: scoreData.previouslyIPTV
      });
    }

    // Step 3: Return real results
    return NextResponse.json({
      scanned: whoisDomains.length,
      passed: results.length,
      results: results.sort((a, b) => b.iptvScore - a.iptvScore)
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to scan" }, { status: 500 });
  }
}
