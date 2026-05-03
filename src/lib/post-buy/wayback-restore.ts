export interface RestoredPage {
  url: string;
  html: string;
  title: string;
  wordCount: number;
  timestamp: string;
}

export interface RestoreResult {
  pages: RestoredPage[];
  totalRestored: number;
}

function stripWaybackToolbar(html: string): string {
  // Remove Wayback toolbar injections
  html = html.replace(/<!-- BEGIN WAYBACK TOOLBAR INSERT -->[\s\S]*?<!-- END WAYBACK TOOLBAR INSERT -->/g, "");
  // Remove Wayback script tags
  html = html.replace(/<script[^>]*archive\.org[^>]*>[\s\S]*?<\/script>/gi, "");
  html = html.replace(/<link[^>]*archive\.org[^>]*/gi, "");
  // Remove wm- prefixed elements Wayback injects
  html = html.replace(/<wm>[\s\S]*?<\/wm>/gi, "");
  return html;
}

function fixInternalLinks(html: string, timestamp: string, targetDomain: string): string {
  const waybackPrefix = `https://web.archive.org/web/${timestamp}/`;
  const waybackPrefixHttp = `http://web.archive.org/web/${timestamp}/`;
  // Replace wayback-prefixed URLs with target domain equivalents
  html = html.replace(new RegExp(waybackPrefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), `https://${targetDomain}/`);
  html = html.replace(new RegExp(waybackPrefixHttp.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), `https://${targetDomain}/`);
  // Also fix any remaining archive.org references
  html = html.replace(/https?:\/\/web\.archive\.org\/web\/\d{14}[^"'\s]*/g, (m) => {
    const pathMatch = m.match(/web\.archive\.org\/web\/\d{14}\/(.*)/);
    if (pathMatch?.[1]) return `https://${targetDomain}/${pathMatch[1]}`;
    return `https://${targetDomain}/`;
  });
  return html;
}

function extractTitle(html: string): string {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return match?.[1]?.trim() || "Untitled";
}

function countWords(html: string): number {
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return text.split(" ").filter(w => w.length > 0).length;
}

function pickBestSnapshots(
  snapshots: string[][],
  max = 10
): string[][] {
  if (snapshots.length <= max) return snapshots;
  // Spread evenly across available snapshots, preferring recent ones
  const step = Math.floor(snapshots.length / max);
  const picked: string[][] = [];
  // Take the most recent 3
  picked.push(...snapshots.slice(-3));
  // Fill remainder evenly from older ones
  for (let i = 0; i < snapshots.length - 3 && picked.length < max; i += step) {
    if (!picked.includes(snapshots[i])) picked.push(snapshots[i]);
  }
  return picked.slice(0, max);
}

export async function restoreContent(
  domain: string,
  targetDomain: string
): Promise<RestoreResult> {
  const pages: RestoredPage[] = [];

  // Step 1 — Fetch all 200-OK snapshots
  let snapshots: string[][] = [];
  try {
    const cdxUrl = `https://web.archive.org/cdx/search/cdx?url=${domain}&output=json&fl=timestamp,original,statuscode&filter=statuscode:200&limit=50`;
    const cdxRes = await fetch(cdxUrl, { signal: AbortSignal.timeout(15000) });
    if (cdxRes.ok) {
      const text = await cdxRes.text();
      if (text.trim()) {
        const rows: string[][] = JSON.parse(text);
        snapshots = rows.slice(1); // skip header row
      }
    }
  } catch (err) {
    console.warn(`[Restore] CDX fetch failed for ${domain}:`, err);
    return { pages: [], totalRestored: 0 };
  }

  if (snapshots.length === 0) return { pages: [], totalRestored: 0 };

  // Step 2 — Pick best 10 snapshots
  const selected = pickBestSnapshots(snapshots, 10);

  // Step 3 — Fetch HTML for each (parallel, 5 at a time)
  const BATCH = 5;
  for (let i = 0; i < selected.length; i += BATCH) {
    const batch = selected.slice(i, i + BATCH);
    const results = await Promise.allSettled(
      batch.map(async (row) => {
        const [timestamp, originalUrl] = row;
        const archiveUrl = `https://web.archive.org/web/${timestamp}/${originalUrl || domain}`;
        const res = await fetch(archiveUrl, {
          headers: { "User-Agent": "Mozilla/5.0" },
          signal: AbortSignal.timeout(12000),
        });
        if (!res.ok) return null;
        let html = await res.text();
        html = stripWaybackToolbar(html);
        html = fixInternalLinks(html, timestamp, targetDomain);
        return {
          url: originalUrl || `https://${domain}/`,
          html,
          title: extractTitle(html),
          wordCount: countWords(html),
          timestamp,
        };
      })
    );
    for (const r of results) {
      if (r.status === "fulfilled" && r.value) pages.push(r.value);
    }
  }

  return { pages, totalRestored: pages.length };
}
