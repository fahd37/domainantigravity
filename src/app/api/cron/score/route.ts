// Cron: runs every 30 minutes — scores PENDING domains with full pipeline
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { filterDomain } from "@/lib/filter";
import { checkWayback, checkWaybackContent } from "@/lib/wayback";
import { getDomainMetrics } from "@/lib/dataforseo";
import { getMajesticMetrics } from "@/lib/majestic";
import { scoreDomaain } from "@/lib/scorer";
import { checkGoogleIndex } from "@/lib/google-index";
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

export async function GET(request: Request) {
  if (request.headers.get("x-cron-secret") !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const pendingDomains = await prisma.domain.findMany({
      where: { status: "PENDING", score: null },
      take: 10,
      orderBy: { createdAt: "asc" },
    });

    if (pendingDomains.length === 0) {
      return NextResponse.json({ success: true, message: "No pending domains to score" });
    }

    // Load settings + niches
    const settingsRows = await prisma.settings.findMany();
    const settings = settingsRows.reduce((acc, r) => { acc[r.key] = decrypt(r.value); return acc; }, {} as Record<string, string>);
    const dbNiches = await prisma.niche.findMany({ where: { active: true } });
    const buyThreshold = parseInt(settings["buy_threshold"] || "55");
    const dfsEmail = settings["dfs_email"];
    const dfsPassword = settings["dfs_password"];
    const majesticKey = settings["majestic_key"] || "free";

    let scored = 0;
    let queued = 0;
    let rejected = 0;

    for (const d of pendingDomains) {
      try {
        const nicheMatch = filterDomain(d.name, dbNiches);
        const waybackResult = await checkWayback(d.name);
        const allKeywords = dbNiches.flatMap(n => n.keywords);
        const contentResult = waybackResult.snapshotCount > 0 && allKeywords.length > 0
          ? await checkWaybackContent(d.name, allKeywords) : undefined;

        const googleIndexResult = await checkGoogleIndex(d.name);

        let seoResult = { referringDomains: 0, backlinks: 0, domainScore: 0, spamScore: 0, ageYears: 0, createdDate: null as Date | null };
        if (dfsEmail && dfsPassword) {
          seoResult = await getDomainMetrics(d.name, dfsEmail, dfsPassword);
        }

        const majesticResult = await getMajesticMetrics(d.name, majesticKey);
        const contentForScorer = contentResult
          ? { contentMatchesNiche: contentResult.contentMatchesNiche, snapshotCount: waybackResult.snapshotCount }
          : undefined;

        const scoreResult = scoreDomaain(d.name, waybackResult, seoResult, nicheMatch, buyThreshold, majesticResult, contentForScorer, undefined, googleIndexResult);

        const newStatus = scoreResult.total >= buyThreshold ? "QUEUED" : "REJECTED";

        await prisma.domain.update({
          where: { id: d.id },
          data: {
            score: scoreResult.total,
            scoreBreakdown: scoreResult.breakdown,
            status: newStatus,
            niche: nicheMatch.matchedNiche || d.niche,
            filterReason: nicheMatch.reason || null,
            dr: seoResult.domainScore,
            da: seoResult.domainScore,
            backlinks: seoResult.backlinks,
            referringDomains: seoResult.referringDomains,
            waybackPages: waybackResult.snapshotCount,
            domainAge: seoResult.ageYears,
            trustFlow: majesticResult.trustFlow,
            citationFlow: majesticResult.citationFlow,
          },
        });

        scored++;
        if (newStatus === "QUEUED") queued++;
        else rejected++;
      } catch (err) {
        console.error(`[Cron/score] Failed to score ${d.name}:`, err);
        await prisma.domain.update({ where: { id: d.id }, data: { status: "FAILED", filterReason: String(err) } }).catch(console.error);
      }
    }

    return NextResponse.json({ success: true, scored, queued, rejected });
  } catch (error) {
    console.error("[Cron/score] Error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
