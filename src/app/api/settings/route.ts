export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || "12345678901234567890123456789012";

function encrypt(text: string) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", Buffer.from(ENCRYPTION_KEY), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString("hex") + ":" + encrypted.toString("hex");
}

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

export async function GET() {
  try {
    const settings = await prisma.settings.findMany();
    const data = settings.reduce((acc, curr) => {
      acc[curr.key] = decrypt(curr.value);
      return acc;
    }, {} as Record<string, string>);
    return NextResponse.json({ data });
  } catch (error) {
    console.error("Failed to fetch settings:", error);
    return NextResponse.json({ error: "Failed to fetch settings", data: {} }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { settings } = body as { settings: Record<string, string> };
    
    if (!settings || typeof settings !== 'object') {
      return NextResponse.json({ error: "Invalid settings" }, { status: 400 });
    }

    for (const [key, value] of Object.entries(settings)) {
      if (typeof value !== 'string') continue;
      const encryptedValue = value.trim() ? encrypt(value.trim()) : '';
      await prisma.settings.upsert({
        where: { key },
        update: { value: encryptedValue },
        create: { key, value: encryptedValue },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to save settings:", error);
    return NextResponse.json({ error: "Failed to save settings" }, { status: 500 });
  }
}
