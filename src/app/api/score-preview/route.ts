export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import { filterDomain, Niche } from "@/lib/filter";
import { checkWayback } from "@/lib/wayback";
import { getDomainMetrics } from "@/lib/dataforseo";
import { getMajesticMetrics } from "@/lib/majestic";
import { scoreParasiteDomain } from "@/lib/parasite-scorer";
import { checkGoogleIndex } from "@/lib/google-index";
import { checkAnchorRelevance, AnchorItem } from "@/lib/anchor-relevance";
import { getHistoricalKeywords, KeywordHistoryItem } from "@/lib/keyword-history";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || "12345678901234567890123456789012";

function decrypt(text: string) {
  try {
    if (!text.includes(":")) return text;
    const textParts = text.split(":");
    const iv = Buffer.from(textParts.shift()!, "hex");
    const encryptedText = Buffer.from(textParts.join(":"), "hex");
    const decipher = crypto.createDecipheriv("aes-256-cbc", Buffer.from(ENCRYPTION_KEY), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch {
    return text;
  }
}

export async function POST(req: Request) {
  try {
    const { domains, nicheSlug, autoBuy } = await req.json();
    if (!Array.isArray(domains)) return NextResponse.json({ error: "Invalid domains array" }, { status: 400 });

    let dbSettings: Record<string, string> = {};
    let dbNiches: Niche[] = [];
    
    try {
      const settings = await prisma.settings.findMany();
      dbSettings = settings.reduce((acc, curr) => {
        acc[curr.key] = decrypt(curr.value);
        return acc;
      }, {} as Record<string, string>);
      
      dbNiches = await prisma.niche.findMany({ where: { active: true } });
    } catch {
      console.warn("DB not available for preview, using empty niches/settings");
    }

    if (nicheSlug) {
      dbNiches = dbNiches.filter(n => n.slug === nicheSlug);
    }

    const dfsEmail = dbSettings["dfs_email"];
    const dfsPassword = dbSettings["dfs_password"];
    const majesticKey = dbSettings["majestic_key"] || "free";
    const buyThreshold = parseInt(dbSettings["buy_threshold"] || "55");

    const results = [];
    
    const BATCH_SIZE = 10;
    for (let i = 0; i < domains.length; i += BATCH_SIZE) {
      const batch = domains.slice(i, i + BATCH_SIZE);
      const batchPromises = batch.map(async (domain: string) => {
        try {
          // Step 1: filterDomain (free, sync)
          const nicheMatch = filterDomain(domain, dbNiches);
          const allKeywords = dbNiches.flatMap(n => n.keywords);
          
          // Step 2: checkGoogleIndex -> HARD REJECT if deindexed
          const googleIndexResult = await checkGoogleIndex(domain);
          if (!googleIndexResult.indexed) {
             const scoreResult = scoreParasiteDomain({
               domain,
               googleIndex: googleIndexResult,
               wayback: { snapshotCount: 0, lastArchived: null, avgWordCount: 0 },
               dataForSeo: { referringDomains: 0, backlinks: 0, domainScore: 0, spamScore: 0, ageYears: 0 },
               anchorRelevance: { anchorScore: 0, relevanceRatio: 0, relevantAnchors: 0, totalAnchors: 0, topAnchors: [], dominantTopic: "" },
               keywordHistory: { hasRankingHistory: false, topKeywords: [], peakTrafficEstimate: 0, trafficScore: 0, primaryTopic: "" },
               majestic: { isToxic: false, tfCfRatio: 0, citationFlow: 0, trustFlow: 0 },
               nicheMatch,
               settings: { buyThreshold }
             });

             return {
               domain,
               ...scoreResult,
               filterReason: nicheMatch.reason,
               matchedNiche: nicheMatch.matchedNiche || "unknown",
               googleIndexed: googleIndexResult.indexed,
               googlePageCount: googleIndexResult.pageCount,
               googleIndexScore: googleIndexResult.indexScore,
             };
          }

          // Step 3: checkWayback
          const waybackResult = await checkWayback(domain);
          
          // Step 4: getMajesticMetrics
          const majesticResult = await getMajesticMetrics(domain, majesticKey);

          let seoResult = { referringDomains: 0, backlinks: 0, domainScore: 0, spamScore: 0, ageYears: 0, createdDate: null as Date | null };
          let anchorRelevance = { anchorScore: 0, relevanceRatio: 0, relevantAnchors: 0, totalAnchors: 0, topAnchors: [] as AnchorItem[], dominantTopic: "" };
          let keywordHistory = { hasRankingHistory: false, topKeywords: [] as KeywordHistoryItem[], peakTrafficEstimate: 0, trafficScore: 0, primaryTopic: "" };

          if (dfsEmail && dfsPassword) {
            // Step 5: getDomainMetrics
            seoResult = await getDomainMetrics(domain, dfsEmail, dfsPassword);
            // Step 6: checkAnchorRelevance
            anchorRelevance = await checkAnchorRelevance(domain, allKeywords, dfsEmail, dfsPassword);
            // Step 7: getHistoricalKeywords
            keywordHistory = await getHistoricalKeywords(domain, dfsEmail, dfsPassword);
          }

          // Step 8: scoreParasiteDomain
          const scoreResult = scoreParasiteDomain({
            domain,
            googleIndex: googleIndexResult,
            wayback: { ...waybackResult, avgWordCount: 'avgWordCount' in waybackResult ? Number(waybackResult.avgWordCount) : 0 },
            dataForSeo: seoResult,
            anchorRelevance,
            keywordHistory,
            majestic: majesticResult,
            nicheMatch,
            settings: { buyThreshold }
          });

          return {
            domain,
            ...scoreResult,
            filterReason: nicheMatch.reason,
            matchedNiche: nicheMatch.matchedNiche || "unknown",
            waybackCount: waybackResult.snapshotCount,
            backlinks: seoResult.backlinks,
            referringDomains: seoResult.referringDomains,
            dr: seoResult.domainScore,
            da: seoResult.domainScore,
            ageYears: seoResult.ageYears || 0,
            tfCfRatio: parseFloat(majesticResult.tfCfRatio.toFixed(2)),
            trustFlow: majesticResult.trustFlow,
            citationFlow: majesticResult.citationFlow,
            isToxic: majesticResult.isToxic,
            googleIndexed: googleIndexResult.indexed,
            googlePageCount: googleIndexResult.pageCount,
            googleIndexScore: googleIndexResult.indexScore,
            sampleIndexedUrls: googleIndexResult.sampleUrls,
            anchorScore: anchorRelevance.anchorScore,
            anchorRelevanceRatio: anchorRelevance.relevanceRatio,
            dominantAnchorTopic: anchorRelevance.dominantTopic,
            topAnchors: anchorRelevance.topAnchors,
            historicalKeywords: keywordHistory.topKeywords,
            peakTrafficEstimate: keywordHistory.peakTrafficEstimate,
            trafficScore: keywordHistory.trafficScore,
          };
        } catch (err) {
          return { domain, total: 0, error: err instanceof Error ? err.message : String(err) };
        }
      });

      const batchResults = await Promise.allSettled(batchPromises);
      for (const res of batchResults) {
        if (res.status === "fulfilled") {
          const val = res.value;
          results.push(val);

          if (val.domain && val.domain !== "unknown") {
            try {
              let status = "PENDING";
              if ('recommendation' in val && val.recommendation === "buy" && autoBuy) {
                status = "BOUGHT";
              }

              const domainData = {
                niche: ('matchedNiche' in val ? val.matchedNiche : null) || "unknown",
                tld: val.domain.split('.').pop() || "com",
                score: ('total' in val ? val.total : 0) || 0,
                scoreBreakdown: ('breakdown' in val ? val.breakdown : {}) || {},
                status: status as 'PENDING' | 'BOUGHT' | 'REJECTED',
                filterReason: ('filterReason' in val ? val.filterReason : null) || null,
                source: "manual",
                dr: ('dr' in val ? Number(val.dr) : 0) || 0,
                da: ('da' in val ? Number(val.da) : 0) || 0,
                backlinks: ('backlinks' in val ? Number(val.backlinks) : 0) || 0,
                referringDomains: ('referringDomains' in val ? Number(val.referringDomains) : 0) || 0,
                waybackPages: ('waybackCount' in val ? Number(val.waybackCount) : 0) || 0,
                domainAge: ('ageYears' in val ? Number(val.ageYears) : 0) || 0,
                trustFlow: ('trustFlow' in val ? Number(val.trustFlow) : 0) || 0,
                citationFlow: ('citationFlow' in val ? Number(val.citationFlow) : 0) || 0,
                linkQualityScore: ('linkQualityScore' in val ? Number(val.linkQualityScore) : null) || null,
                aliveRatio: ('aliveRatio' in val ? Number(val.aliveRatio) : null) || null,
                indexedRatio: ('indexedRatio' in val ? Number(val.indexedRatio) : null) || null,
                relevanceRatio: ('relevanceRatio' in val ? Number(val.relevanceRatio) : null) || null,
                linkVelocityRisk: ('linkVelocityRisk' in val ? Boolean(val.linkVelocityRisk) : null) ?? null,
                geoDistribution: ('geoDistribution' in val ? Number(val.geoDistribution) : null) || null,
                linkVerdict: ('linkVerdict' in val ? String(val.linkVerdict) : null) || null,
                googleIndexed: ('googleIndexed' in val ? Boolean(val.googleIndexed) : null) ?? null,
                googlePageCount: ('googlePageCount' in val ? Number(val.googlePageCount) : null) || null,
                googleIndexScore: ('googleIndexScore' in val ? Number(val.googleIndexScore) : null) || null,
                sampleIndexedUrls: ('sampleIndexedUrls' in val ? val.sampleIndexedUrls as string[] : []),
                anchorScore: ('anchorScore' in val ? Number(val.anchorScore) : null) || null,
                anchorRelevanceRatio: ('anchorRelevanceRatio' in val ? Number(val.anchorRelevanceRatio) : null) || null,
                dominantAnchorTopic: ('dominantAnchorTopic' in val ? String(val.dominantAnchorTopic) : null) || null,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                historicalKeywords: ('historicalKeywords' in val ? val.historicalKeywords as any : []),
                peakTrafficEstimate: ('peakTrafficEstimate' in val ? Number(val.peakTrafficEstimate) : null) || null,
                trafficScore: ('trafficScore' in val ? Number(val.trafficScore) : null) || null,
                parasiteScore: ('total' in val ? val.total : 0) || 0,
                parasiteReadiness: ('parasiteReadiness' in val ? String(val.parasiteReadiness) : null) || null,
              };

              await prisma.domain.upsert({
                where: { name: val.domain },
                update: domainData,
                create: { name: val.domain, ...domainData },
              });
            } catch (dbErr) {
              console.error("Failed to save domain", dbErr);
            }
          }
        } else {
          results.push({ domain: "unknown", total: 0, error: "Promise rejected" });
        }
      }
    }

    results.sort((a, b) => (b.total || 0) - (a.total || 0));

    return NextResponse.json({ results });
  } catch (error) {
    console.error("Score preview error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
