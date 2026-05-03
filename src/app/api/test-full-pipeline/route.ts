export const runtime = 'nodejs';
export const dynamic = 'force-dynamic'
import { NextResponse } from "next/server";
import { filterDomain } from "@/lib/filter";
import { checkWayback, checkWaybackContent } from "@/lib/wayback";
import { getMajesticMetrics } from "@/lib/majestic";
import { scoreDomaain } from "@/lib/scorer";
import { checkGoogleIndex } from "@/lib/google-index";
import { prisma } from "@/lib/prisma";

const TEST_DOMAINS = [
  "ai-automation.com",
  "seo-marketing.de",
  "healthcoach.io",
  "digitaltools.com",
  "financebudget.net",
];

export async function GET() {
  try {
    let dbNiches: Awaited<ReturnType<typeof prisma.niche.findMany>> = [];
    try {
      dbNiches = await prisma.niche.findMany({ where: { active: true } });
    } catch {
      // DB might be unavailable in test environment
    }

    const results = await Promise.all(
      TEST_DOMAINS.map(async (domain) => {
        const start = Date.now();
        try {
          const nicheMatch = filterDomain(domain, dbNiches);
          const waybackResult = await checkWayback(domain);

          const allKeywords = dbNiches.flatMap(n => n.keywords);
          const contentResult =
            waybackResult.snapshotCount > 0 && allKeywords.length > 0
              ? await checkWaybackContent(domain, allKeywords)
              : null;

          const googleIndexResult = await checkGoogleIndex(domain);

          const seoResult = { referringDomains: 0, backlinks: 0, domainScore: 0, spamScore: 0, ageYears: 0, createdDate: null as Date | null };
          const majesticResult = await getMajesticMetrics(domain);

          const contentForScorer = contentResult
            ? { contentMatchesNiche: contentResult.contentMatchesNiche, snapshotCount: waybackResult.snapshotCount }
            : undefined;

          const scoreResult = scoreDomaain(domain, waybackResult, seoResult, nicheMatch, 55, majesticResult, contentForScorer, undefined, googleIndexResult);

          return {
            domain,
            score: scoreResult.total,
            breakdown: scoreResult.breakdown,
            recommendation: scoreResult.recommendation,
            filterReason: nicheMatch.reason,
            matchedNiche: nicheMatch.matchedNiche,
            waybackPages: waybackResult.snapshotCount,
            lastArchived: waybackResult.lastArchived,
            referringDomains: seoResult.referringDomains,
            ageYears: seoResult.ageYears,
            tfCfRatio: parseFloat(majesticResult.tfCfRatio.toFixed(2)),
            trustFlow: majesticResult.trustFlow,
            citationFlow: majesticResult.citationFlow,
            isToxic: majesticResult.isToxic,
            contentMatchesNiche: contentResult?.contentMatchesNiche ?? null,
            contentSample: contentResult?.contentSample ?? "",
            durationMs: Date.now() - start,
          };
        } catch (err) {
          return {
            domain,
            error: String(err),
            durationMs: Date.now() - start,
          };
        }
      })
    );

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      domains: TEST_DOMAINS.length,
      results,
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
