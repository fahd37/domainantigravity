export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runPostBuyPipeline } from "@/lib/post-buy/pipeline";
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
    const { domainId } = await req.json();
    if (!domainId) return NextResponse.json({ error: "domainId required" }, { status: 400 });

    const domain = await prisma.domain.findUnique({ where: { id: domainId } });
    if (!domain) return NextResponse.json({ error: "Domain not found" }, { status: 404 });

    const settingsRows = await prisma.settings.findMany();
    const settings = settingsRows.reduce((acc, r) => { acc[r.key] = decrypt(r.value); return acc; }, {} as Record<string, string>);

    const niche = await prisma.niche.findFirst({ where: { slug: domain.niche } });

    // Run pipeline non-blocking, return immediately
    setImmediate(async () => {
      await runPostBuyPipeline(domain.name, domain.niche, {
        prisma,
        anthropicApiKey: settings["anthropic_api_key"],
        cfApiToken: settings["cf_api_token"],
        cfAccountId: settings["cf_account_id"],
        googleServiceAccountKey: settings["google_sa_key"],
        resendApiKey: settings["resend_api_key"],
        nicheKeywords: niche?.keywords || [],
      });
    });

    return NextResponse.json({ success: true, message: `Pipeline started for ${domain.name}` });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
