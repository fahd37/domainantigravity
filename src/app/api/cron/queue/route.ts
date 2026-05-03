export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Cron: runs every 5 minutes — drains QUEUED domains through Namecheap purchase
import { NextResponse } from "next/server";
import { queue } from "@/lib/queue";
import { prisma } from "@/lib/prisma";
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
    // Load settings
    const settingsRows = await prisma.settings.findMany();
    const settings = settingsRows.reduce((acc, r) => { acc[r.key] = decrypt(r.value); return acc; }, {} as Record<string, string>);

    const apiUser = settings["nc_api_user"] || settings["namecheap_user"];
    const apiKey = settings["nc_api_key"] || settings["namecheap_key"];

    if (!apiUser || !apiKey) {
      return NextResponse.json({ error: "Namecheap credentials not configured" }, { status: 400 });
    }

    // Load QUEUED domains from DB into in-memory queue
    const queuedDomains = await prisma.domain.findMany({
      where: { status: "QUEUED" },
      orderBy: { score: "desc" },
      take: 20,
    });

    for (const d of queuedDomains) {
      // Only add if not already in queue
      const existing = queue.getQueueStatus().items.find(i => i.domain === d.name);
      if (!existing) {
        queue.addToQueue({ domain: d.name, score: d.score || 0, niche: d.niche });
      }
    }

    const queueStatus = queue.getQueueStatus();
    if (queueStatus.items.filter(i => i.status === "pending").length === 0) {
      return NextResponse.json({ success: true, message: "Queue is empty" });
    }

    // Fire and forget
    queue.processQueue({
      apiUser,
      apiKey,
      sandbox: settings["nc_sandbox"] === "true",
      maxPerDay: parseInt(settings["max_domains_day"] || "10"),
      dailyBudget: parseInt(settings["daily_budget"] || "100"),
      cfApiToken: settings["cf_api_token"],
      resendApiKey: settings["resend_api_key"],
      prisma,
    }).catch(console.error);

    return NextResponse.json({
      success: true,
      message: "Queue processing triggered",
      queueLength: queueStatus.items.filter(i => i.status === "pending").length,
    });
  } catch (error) {
    console.error("[Cron/queue] Error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
