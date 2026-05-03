import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateArticlesForDomain } from "@/lib/post-buy/content-generator";
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
    const { domainId, niche } = await req.json();
    if (!domainId) return NextResponse.json({ error: "domainId required" }, { status: 400 });

    const domain = await prisma.domain.findUnique({ where: { id: domainId } });
    if (!domain) return NextResponse.json({ error: "Domain not found" }, { status: 404 });

    const settingsRows = await prisma.settings.findMany();
    const settings = settingsRows.reduce((acc, r) => { acc[r.key] = decrypt(r.value); return acc; }, {} as Record<string, string>);

    const nicheRecord = await prisma.niche.findFirst({ where: { slug: niche || domain.niche } });
    const keywords = nicheRecord?.keywords || [niche || domain.niche];

    setImmediate(async () => {
      const dfsCredentials = settings["dfs_email"] && settings["dfs_password"]
        ? { email: settings["dfs_email"], pass: settings["dfs_password"] }
        : undefined;

      const articles = await generateArticlesForDomain(
        domain.name,
        niche || domain.niche,
        keywords,
        5,
        settings["anthropic_api_key"],
        dfsCredentials
      );

      for (const article of articles) {
        await prisma.article.create({
          data: {
            domainId: domain.id,
            title: article.title,
            slug: article.slug,
            content: article.content,
            metaDescription: article.metaDescription,
            keywords: article.keywords,
            wordCount: article.wordCount,
            publishedAt: new Date(),
          },
        }).catch(console.error);
      }
    });

    return NextResponse.json({ success: true, message: "Content generation started" });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
