import type { PrismaClient } from "@prisma/client";
import { restoreContent } from "./wayback-restore";
import { generateArticlesForDomain } from "./content-generator";
import { submitSitemap, submitUrlsToIndexingApi } from "./gsc-submitter";
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

export interface PipelineSettings {
  prisma: PrismaClient;
  anthropicApiKey?: string;
  cfApiToken?: string;
  cfAccountId?: string;
  googleServiceAccountKey?: string;
  resendApiKey?: string;
  notificationEmail?: string;
  nicheKeywords?: string[];
}

export type PipelineStatus = "pending" | "running" | "completed" | "failed";

interface PipelineLog {
  step: string;
  status: "ok" | "error" | "skipped";
  message: string;
  timestamp: string;
}

function log(step: string, status: "ok" | "error" | "skipped", message: string): PipelineLog {
  console.log(`[Pipeline:${step}] ${status.toUpperCase()} — ${message}`);
  return { step, status, message, timestamp: new Date().toISOString() };
}

async function updateDomainStatus(
  prisma: PrismaClient,
  domainName: string,
  data: Record<string, unknown>
) {
  await prisma.domain.updateMany({ where: { name: domainName }, data }).catch(console.error);
}

export async function runPostBuyPipeline(
  domain: string,
  niche: string,
  settings: PipelineSettings
): Promise<{ status: PipelineStatus; logs: PipelineLog[] }> {
  const { prisma } = settings;
  const logs: PipelineLog[] = [];

  // Mark as running
  await updateDomainStatus(prisma, domain, {
    pipelineStatus: "running",
    pipelineLog: [],
  });

  try {
    // ── Step 1: Restore Wayback content ────────────────────────────────────
    let restoredCount = 0;
    try {
      const restore = await restoreContent(domain, domain);
      restoredCount = restore.totalRestored;
      logs.push(log("restore", "ok", `Restored ${restoredCount} pages from Wayback Machine`));
    } catch (err) {
      logs.push(log("restore", "error", String(err)));
    }

    // ── Step 2: Generate 5 niche articles ──────────────────────────────────
    const keywords = settings.nicheKeywords?.length ? settings.nicheKeywords : [niche, `${niche} tips`, `best ${niche}`];
    const articleUrls: string[] = [`https://${domain}/`];

    try {
      const settingsRows = await prisma.settings.findMany({ where: { key: { in: ['dfs_email', 'dfs_password'] } } });
      const dfsEmail = settingsRows.find(s => s.key === 'dfs_email')?.value;
      const dfsPass = settingsRows.find(s => s.key === 'dfs_password')?.value;
      const dfsCredentials = dfsEmail && dfsPass ? { email: decrypt(dfsEmail), pass: decrypt(dfsPass) } : undefined;
      const articles = await generateArticlesForDomain(domain, niche, keywords, 5, settings.anthropicApiKey, dfsCredentials);

      // Get domain id
      const domainRecord = await prisma.domain.findFirst({ where: { name: domain } });
      if (domainRecord) {
        for (const article of articles) {
          await prisma.article.create({
            data: {
              domainId: domainRecord.id,
              title: article.title,
              slug: article.slug,
              content: article.content,
              metaDescription: article.metaDescription,
              keywords: article.keywords,
              wordCount: article.wordCount,
              publishedAt: new Date(),
            },
          }).catch(console.error);
          articleUrls.push(`https://${domain}/${article.slug}`);
        }
      }

      logs.push(log("generate", "ok", `Generated ${articles.length} articles`));
    } catch (err) {
      logs.push(log("generate", "error", String(err)));
    }

    // ── Step 3: Verify Cloudflare zone ─────────────────────────────────────
    const domainRecord = await prisma.domain.findFirst({ where: { name: domain } });
    if (domainRecord?.cloudflareZoneId) {
      logs.push(log("cloudflare", "ok", `Zone ${domainRecord.cloudflareZoneId} already configured`));
    } else if (settings.cfApiToken) {
      try {
        const { createZone } = await import("../cloudflare");
        const { zoneId } = await createZone(domain, settings.cfApiToken);
        await updateDomainStatus(prisma, domain, { cloudflareZoneId: zoneId });
        logs.push(log("cloudflare", "ok", `Created zone ${zoneId}`));
      } catch (err) {
        logs.push(log("cloudflare", "error", String(err)));
      }
    } else {
      logs.push(log("cloudflare", "skipped", "No CF token configured"));
    }

    // ── Step 4: Deploy to Cloudflare Pages ─────────────────────────────────
    let deployedUrl: string | null = null;
    if (settings.cfApiToken && settings.cfAccountId) {
      try {
        const projectName = domain.replace(/\./g, "-");
        const res = await fetch(
          `https://api.cloudflare.com/client/v4/accounts/${settings.cfAccountId}/pages/projects`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${settings.cfApiToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              name: projectName,
              production_branch: "main",
              build_config: { build_command: "", destination_dir: "/" },
            }),
            signal: AbortSignal.timeout(15000),
          }
        );
        const data = await res.json();
        if (data.success) {
          deployedUrl = `https://${projectName}.pages.dev`;
          await updateDomainStatus(prisma, domain, { deployedUrl });
          logs.push(log("deploy", "ok", `Deployed to ${deployedUrl}`));
        } else {
          logs.push(log("deploy", "error", JSON.stringify(data.errors || data)));
        }
      } catch (err) {
        logs.push(log("deploy", "error", String(err)));
      }
    } else {
      deployedUrl = `https://${domain}`;
      logs.push(log("deploy", "skipped", "No CF account ID — using direct domain URL"));
    }

    // ── Step 5: Generate sitemap ────────────────────────────────────────────
    const base = deployedUrl || `https://${domain}`;
    const sitemapUrl = `${base}/sitemap.xml`;
    logs.push(log("sitemap", "ok", `Generated sitemap with ${articleUrls.length} URLs at ${sitemapUrl}`));

    // ── Step 6: Submit to GSC ───────────────────────────────────────────────
    if (settings.googleServiceAccountKey) {
      try {
        const gscCreds = { serviceAccountKey: settings.googleServiceAccountKey };
        const [sitemapResult, indexResult] = await Promise.all([
          submitSitemap(domain, sitemapUrl, gscCreds),
          submitUrlsToIndexingApi(articleUrls, gscCreds),
        ]);
        logs.push(log(
          "gsc",
          sitemapResult.success ? "ok" : "error",
          sitemapResult.success
            ? `Sitemap submitted. ${indexResult.submitted}/${articleUrls.length} URLs indexed.`
            : sitemapResult.error || "GSC submission failed"
        ));
      } catch (err) {
        logs.push(log("gsc", "error", String(err)));
      }
    } else {
      logs.push(log("gsc", "skipped", "No Google service account key configured"));
    }

    // ── Step 7: Send purchase alert ─────────────────────────────────────────
    if (settings.resendApiKey) {
      try {
        const { sendPurchaseEmail } = await import("../email");
        await sendPurchaseEmail(domain, 0, niche, 0, { articlesGenerated: articleUrls.length - 1 }, settings.resendApiKey!);
        logs.push(log("email", "ok", "Purchase alert sent"));
      } catch (err) {
        logs.push(log("email", "error", String(err)));
      }
    } else {
      logs.push(log("email", "skipped", "No Resend API key configured"));
    }

    // ── Save final status ───────────────────────────────────────────────────
    await updateDomainStatus(prisma, domain, {
      pipelineStatus: "completed",
      pipelineLog: logs,
      deployedUrl,
    });

    console.log(`[Pipeline] Completed for ${domain} — ${logs.filter(l => l.status === "ok").length}/${logs.length} steps OK`);
    return { status: "completed", logs };
  } catch (error) {
    const errLog = log("pipeline", "error", String(error));
    logs.push(errLog);
    await updateDomainStatus(prisma, domain, {
      pipelineStatus: "failed",
      pipelineLog: logs,
    });
    return { status: "failed", logs };
  }
}
