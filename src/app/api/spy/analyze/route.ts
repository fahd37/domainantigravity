export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { analyzeCompetitorPortfolio } from "@/lib/spy/competitor-analyzer";
import { extractWinningPatterns } from "@/lib/spy/pattern-extractor";
import { findDomainsFromTwitter } from "@/lib/spy/twitter-finder";
import { checkWayback } from "@/lib/wayback";
import { scoreDomaain } from "@/lib/scorer";
import { filterDomain } from "@/lib/filter";
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
    const { input } = await req.json();
    if (!input?.trim()) return NextResponse.json({ error: "Input required" }, { status: 400 });

    const settingsRows = await prisma.settings.findMany().catch(() => []);
    const settings = settingsRows.reduce((acc, r) => { acc[r.key] = decrypt(r.value); return acc; }, {} as Record<string, string>);
    const dfsEmail = settings["dfs_email"];
    const dfsPassword = settings["dfs_password"];

    const isTwitter = input.includes("@") || input.includes("twitter.com") || input.includes("x.com");
    let domains: string[] = [];
    let competitorDomain = input.trim().replace(/^@/, "").replace(/^https?:\/\/(www\.)?/, "").split("/")[0];

    if (isTwitter) {
      const twitterResult = await findDomainsFromTwitter(input);
      domains = twitterResult.domains;
      competitorDomain = input.replace(/^@/, "");
    } else {
      const portfolio = await analyzeCompetitorPortfolio(competitorDomain, dfsEmail, dfsPassword);
      domains = portfolio.domains;
    }

    // Load niches for scoring
    const niches = await prisma.niche.findMany({ where: { active: true } }).catch(() => []);

    // Score top 20 domains through full pipeline
    const scoredDomains = await Promise.all(
      domains.slice(0, 20).map(async (domain) => {
        try {
          const wayback = await checkWayback(domain);
          const nicheMatch = filterDomain(domain, niches);
          const score = scoreDomaain(
            domain, wayback,
            { referringDomains: 0, backlinks: 0, domainScore: 0, spamScore: 0, ageYears: 0 },
            nicheMatch, 55
          );
          return {
            domain,
            score: score.total,
            recommendation: score.recommendation,
            waybackPages: wayback.snapshotCount,
            lastArchived: wayback.lastArchived,
            matchedNiche: nicheMatch.matchedNiche,
          };
        } catch {
          return { domain, score: 0, recommendation: "reject" as const, waybackPages: 0, lastArchived: null, matchedNiche: null };
        }
      })
    );

    // Extract patterns from ALL discovered domains
    const patterns = await extractWinningPatterns(domains, niches);

    // Save to SpyAnalysis
    const analysis = await prisma.spyAnalysis.create({
      data: {
        competitorInput: input,
        discoveredDomains: domains,
        patterns: patterns as unknown as object,
        importedAsNiche: false,
      },
    }).catch(() => null);

    return NextResponse.json({
      id: analysis?.id,
      competitorDomain,
      isTwitter,
      domains: scoredDomains,
      totalDiscovered: domains.length,
      patterns,
    });
  } catch (error) {
    console.error("[Spy/analyze] Error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
