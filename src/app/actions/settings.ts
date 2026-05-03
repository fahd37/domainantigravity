"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import crypto from "crypto";

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || "12345678901234567890123456789012"; // Must be 256 bits (32 characters)
const IV_LENGTH = 16; // For AES, this is always 16

function encrypt(text: string) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv("aes-256-cbc", Buffer.from(ENCRYPTION_KEY), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString("hex") + ":" + encrypted.toString("hex");
}

export async function saveSettings(data: Record<string, string>) {
  try {
    for (const [key, value] of Object.entries(data)) {
      // Only update if value changed and is not masked
      if (value === "••••••••••••••••") continue;
      
      const encryptedValue = encrypt(value);
      await prisma.settings.upsert({
        where: { key },
        update: { value: encryptedValue },
        create: { key, value: encryptedValue },
      });
    }
    revalidatePath("/settings");
    return { success: true };
  } catch (error) {
    console.error("Failed to save settings:", error);
    return { error: "Failed to save settings to database" };
  }
}
