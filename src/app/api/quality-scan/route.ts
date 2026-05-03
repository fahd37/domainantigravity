import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkLinkQuality } from "@/lib/link-quality";
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
    const { domainIds } = await req.json();
    if (!Array.isArray(domainIds) || domainIds.length === 0) {
      return NextResponse.json({ error: "domainIds array required" }, { status: 400 });
    }

    const settingsRows = await prisma.settings.findMany();
    const settings = settingsRows.reduce((acc, r) => { acc[r.key] = decrypt(r.value); return acc; }, {} as Record<string, string>);
    const dfsEmail = settings["dfs_email"];
    const dfsPassword = settings["dfs_password"];

    const domains = await prisma.domain.findMany({
      where: { id: { in: domainIds } },
    });

    const results = [];
    for (const domain of domains) {
      try {
        const report = await checkLinkQuality(domain.name, dfsEmail, dfsPassword);

        await prisma.domain.update({
          where: { id: domain.id },
          data: {
            linkQualityScore: report.qualityScore,
            aliveRatio: report.aliveRatio,
            indexedRatio: report.indexedRatio,
            relevanceRatio: report.relevanceRatio,
            linkVelocityRisk: report.linkVelocityRisk,
            geoDistribution: report.geoDistribution,
            linkVerdict: report.verdict,
            // Override to 0 if toxic
            ...(report.verdict === "toxic" ? { score: 0, status: "REJECTED" } : {}),
          },
        });

        results.push({
          id: domain.id,
          domain: domain.name,
          linkQualityScore: report.qualityScore,
          verdict: report.verdict,
          aliveRatio: report.aliveRatio,
          indexedRatio: report.indexedRatio,
        });
      } catch (err) {
        results.push({ id: domain.id, domain: domain.name, error: String(err) });
      }
    }

    return NextResponse.json({ success: true, results });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
