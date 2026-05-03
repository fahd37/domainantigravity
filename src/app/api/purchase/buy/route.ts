import { NextResponse } from "next/server";
import { queue } from "@/lib/queue";
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
    const { domain, score, niche } = await req.json();
    
    let settings: Record<string, string> = {};
    try {
      const rows = await prisma.settings.findMany();
      settings = rows.reduce((acc, curr) => {
        acc[curr.key] = decrypt(curr.value);
        return acc;
      }, {} as Record<string, string>);
    } catch {
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    const buyThreshold = parseInt(settings["buy_threshold"] || "55");
    
    if (score < buyThreshold) {
      return NextResponse.json({ error: "Score below configured buy threshold" }, { status: 400 });
    }

    const apiUser = settings["namecheap_user"];
    const apiKey = settings["namecheap_key"];
    const sandbox = settings["namecheap_sandbox"] === "true";

    if (!apiUser || !apiKey) {
      return NextResponse.json({ error: "Namecheap credentials missing in settings" }, { status: 400 });
    }

    const item = queue.addToQueue({ domain, score, niche });
    
    // Fire and forget processQueue
    queue.processQueue({
      apiUser,
      apiKey,
      sandbox,
      maxPerDay: parseInt(settings["max_per_day"] || "10"),
      dailyBudget: parseInt(settings["daily_budget"] || "100")
    }).catch(console.error);

    return NextResponse.json({ success: true, item });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
