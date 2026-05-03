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

export async function getSettings() {
  const settings = await prisma.settings.findMany();
  return settings.reduce((acc, curr) => {
    acc[curr.key] = decrypt(curr.value);
    return acc;
  }, {} as Record<string, string>);
}

export async function getDomainMetrics(domain: string, email?: string, password?: string) {
  let finalEmail = email;
  let finalPassword = password;
  
  if (!finalEmail || !finalPassword) {
    const settings = await getSettings();
    if (!settings.dataForSeoEmail || !settings.dataForSeoPassword) {
      return {
        referringDomains: 0,
        backlinks: 0,
        brokenBacklinks: 0,
        referringIps: 0,
        domainScore: 0,
        spamScore: 0,
        createdDate: null,
        ageYears: 0,
        configured: false,
        message: 'DataForSEO not configured — DR score unavailable'
      };
    }
    finalEmail = settings.dataForSeoEmail;
    finalPassword = settings.dataForSeoPassword;
  }

  const credentials = Buffer.from(`${finalEmail}:${finalPassword}`).toString("base64");

  try {
    const res = await fetch("https://api.dataforseo.com/v3/backlinks/domain_pages_summary/live", {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([{ target: domain }]),
    });

    if (!res.ok) {
      throw new Error(`DataForSEO API error: ${res.status}`);
    }

    const data = await res.json();
    const result = data.tasks?.[0]?.result?.[0] || {};

    const referringDomains = result.referring_domains || 0;
    const backlinks = result.backlinks || 0;
    const brokenBacklinks = result.broken_backlinks || 0;
    const referringIps = result.referring_ips || 0;

    let spamScore = 0;
    if (backlinks > 0 && referringDomains < 3) {
      spamScore = 100;
    }

    const domainScore = Math.min(40, Math.floor(referringDomains / 2));

    // Extract WHOIS registration date for age signal
    let createdDate: Date | null = null;
    let ageYears = 0;
    
    try {
      const whoisRes = await fetch("https://api.dataforseo.com/v3/domain_analytics/whois/overview/live", {
        method: "POST",
        headers: {
          Authorization: `Basic ${credentials}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify([{ target: domain }]),
      });

      if (whoisRes.ok) {
        const whoisData = await whoisRes.json();
        const whoisResult = whoisData.tasks?.[0]?.result?.[0];
        const createdStr = whoisResult?.created_date || whoisResult?.creation_date;
        if (createdStr) {
          createdDate = new Date(createdStr);
          const msPerYear = 1000 * 60 * 60 * 24 * 365.25;
          ageYears = Math.floor((Date.now() - createdDate.getTime()) / msPerYear);
        }
      }
    } catch {
      // WHOIS lookup is best-effort
    }

    return {
      referringDomains,
      backlinks,
      brokenBacklinks,
      referringIps,
      domainScore,
      spamScore,
      createdDate,
      ageYears,
      configured: true,
      message: ''
    };
  } catch (error) {
    console.error(`DataForSEO check failed for ${domain}:`, error);
    return {
      referringDomains: 0,
      backlinks: 0,
      brokenBacklinks: 0,
      referringIps: 0,
      domainScore: 0,
      spamScore: 0,
      createdDate: null,
      ageYears: 0,
      configured: true,
      message: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
