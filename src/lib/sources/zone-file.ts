import * as fs from "fs";
import * as readline from "readline";
import * as path from "path";

export interface ZoneDomain {
  domain: string;
  nameserver: string;
}

/**
 * Streams a zone file line by line, filtering for niche keywords.
 * Zone file format: domainname NS nameserver.
 * Never loads the full file into memory — safe for 10GB+ files.
 */
export async function* processZoneFile(
  filePath: string,
  keywords: string[]
): AsyncGenerator<string[], void, unknown> {
  const lowerKeywords = keywords.map(k => k.toLowerCase());

  const fileStream = fs.createReadStream(path.resolve(filePath));
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  let batch: string[] = [];
  const BATCH_SIZE = 1000;

  for await (const line of rl) {
    // Skip comments and empty lines
    if (!line || line.startsWith(";") || line.startsWith("#")) continue;

    // Zone file format: "domainname NS nameserver" (tab or space separated)
    const parts = line.trim().split(/\s+/);
    if (parts.length < 3) continue;

    const recordType = parts[1]?.toUpperCase();
    if (recordType !== "NS") continue;

    const rawDomain = parts[0].toLowerCase().replace(/\.$/, ""); // strip trailing dot
    if (!rawDomain || rawDomain.includes("@")) continue;

    // Keyword filter in-stream — only keep matching domains
    const matches = lowerKeywords.some(kw => rawDomain.includes(kw));
    if (!matches) continue;

    // Reconstruct FQDN (zone files may omit .com/.net — caller adds TLD)
    batch.push(rawDomain);

    if (batch.length >= BATCH_SIZE) {
      yield batch;
      batch = [];
    }
  }

  if (batch.length > 0) yield batch;
}

/**
 * Count total lines in a zone file (for progress tracking).
 * Streams the file without loading into memory.
 */
export async function countZoneFileLines(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    let count = 0;
    const stream = fs.createReadStream(path.resolve(filePath));
    stream.on("data", (chunk) => {
      const buf = chunk as Buffer;
      for (let i = 0; i < buf.length; i++) {
        if (buf[i] === 10) count++; // newline byte
      }
    });
    stream.on("end", () => resolve(count));
    stream.on("error", reject);
  });
}

/**
 * Download latest .com zone file from ICANN CZDS.
 * Requires ICANN_USERNAME + ICANN_PASSWORD env vars.
 */
export async function downloadZoneFile(
  tld: "com" | "net" | "org" = "com",
  destPath: string
): Promise<{ success: boolean; sizeMB: number; error?: string }> {
  const username = process.env.ICANN_USERNAME;
  const password = process.env.ICANN_PASSWORD;

  if (!username || !password) {
    return { success: false, sizeMB: 0, error: "ICANN_USERNAME and ICANN_PASSWORD required" };
  }

  try {
    // Step 1: Get access token
    const authRes = await fetch("https://account.icann.org/api/authenticate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
      signal: AbortSignal.timeout(15000),
    });

    if (!authRes.ok) {
      return { success: false, sizeMB: 0, error: `Auth failed: ${authRes.status}` };
    }

    const authData = await authRes.json();
    const token = authData.accessToken || authData.token;

    if (!token) return { success: false, sizeMB: 0, error: "No token in ICANN auth response" };

    // Step 2: Download zone file (streaming to disk)
    const zoneUrl = `https://czds-api.icann.org/czds/downloads/${tld}.zone`;
    const zoneRes = await fetch(zoneUrl, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(3600000), // 1h timeout for large files
    });

    if (!zoneRes.ok) {
      return { success: false, sizeMB: 0, error: `Zone download failed: ${zoneRes.status}` };
    }

    // Stream to file
    const writer = fs.createWriteStream(path.resolve(destPath));
    let bytes = 0;

    const reader = zoneRes.body?.getReader();
    if (!reader) return { success: false, sizeMB: 0, error: "No response body" };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      writer.write(Buffer.from(value));
      bytes += value.length;
    }

    await new Promise<void>((res, rej) => writer.end((err: Error | null | undefined) => err ? rej(err) : res()));

    return { success: true, sizeMB: Math.round(bytes / 1024 / 1024) };
  } catch (err) {
    return { success: false, sizeMB: 0, error: String(err) };
  }
}
