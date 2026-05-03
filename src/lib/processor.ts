import pLimit from "p-limit";
import { filterDomain, type Niche } from "./filter";
import { checkWayback } from "./wayback";

export interface ProcessorProgress {
  processed: number;
  total: number;
  passed: number;
  failed: number;
  elapsedMs: number;
  ratePerMin: number;
  estimatedRemainingMs: number;
  passRate: number;
}

export interface ProcessorResult {
  domain: string;
  passed: boolean;
  waybackCount?: number;
  error?: string;
}

export type ProgressCallback = (progress: ProcessorProgress) => void;

// In-memory singleton for SSE progress reporting
export const SCAN_STATE = {
  running: false,
  processed: 0,
  total: 0,
  passed: 0,
  failed: 0,
  startedAt: null as Date | null,
  sourcesActive: {
    zoneFile: false,
    certStream: false,
    expiredDomains: true,
    godaddy: true,
  },
};

export function resetScanState(total: number) {
  SCAN_STATE.running = true;
  SCAN_STATE.processed = 0;
  SCAN_STATE.total = total;
  SCAN_STATE.passed = 0;
  SCAN_STATE.failed = 0;
  SCAN_STATE.startedAt = new Date();
}

export function finishScanState() {
  SCAN_STATE.running = false;
}

/**
 * Process a batch of domains with configurable concurrency.
 * Uses token-bucket rate limiting via p-limit.
 *
 * At concurrency=50, processes ~3000 domains/min → 50k/day achievable.
 */
export async function processDomainsBatch(
  domains: string[],
  niches: Niche[],
  options: {
    batchSize?: number;
    concurrency?: number;
    onProgress?: ProgressCallback;
    waybackOnly?: boolean; // skip DataForSEO for speed
  } = {}
): Promise<ProcessorResult[]> {
  const {
    batchSize = 1000,
    concurrency = 50,
    onProgress,
    waybackOnly = true,
  } = options;

  const limit = pLimit(concurrency);
  const results: ProcessorResult[] = [];
  const startedAt = Date.now();

  let processed = 0;
  let passed = 0;
  let failed = 0;

  // Update global scan state
  SCAN_STATE.running = true;
  SCAN_STATE.total = domains.length;
  SCAN_STATE.startedAt = SCAN_STATE.startedAt || new Date();

  const emitProgress = () => {
    const elapsedMs = Date.now() - startedAt;
    const elapsedMin = elapsedMs / 60000 || 0.001;
    const ratePerMin = Math.round(processed / elapsedMin);
    const remaining = domains.length - processed;
    const estimatedRemainingMs = ratePerMin > 0 ? (remaining / ratePerMin) * 60000 : 0;

    const progress: ProcessorProgress = {
      processed,
      total: domains.length,
      passed,
      failed,
      elapsedMs,
      ratePerMin,
      estimatedRemainingMs,
      passRate: processed > 0 ? passed / processed : 0,
    };

    // Update singleton state for SSE
    SCAN_STATE.processed = processed;
    SCAN_STATE.passed = passed;
    SCAN_STATE.failed = failed;

    onProgress?.(progress);
  };

  // Process in chunks of batchSize to avoid overwhelming memory
  for (let i = 0; i < domains.length; i += batchSize) {
    const chunk = domains.slice(i, i + batchSize);

    const chunkPromises = chunk.map(domain =>
      limit(async (): Promise<ProcessorResult> => {
        try {
          // Step 1: Fast keyword filter (sync — no API call)
          const nicheMatch = filterDomain(domain, niches);
          if (!nicheMatch.passes) {
            processed++;
            if (processed % 500 === 0) emitProgress();
            return { domain, passed: false };
          }

          // Step 2: Wayback check (lightweight)
          if (waybackOnly) {
            const wayback = await checkWayback(domain);
            passed++;
            processed++;
            if (processed % 500 === 0) emitProgress();
            return { domain, passed: true, waybackCount: wayback.snapshotCount };
          }

          passed++;
          processed++;
          if (processed % 500 === 0) emitProgress();
          return { domain, passed: true };
        } catch (err) {
          failed++;
          processed++;
          if (processed % 500 === 0) emitProgress();
          return { domain, passed: false, error: String(err) };
        }
      })
    );

    const chunkResults = await Promise.all(chunkPromises);
    results.push(...chunkResults);
    emitProgress();
  }

  SCAN_STATE.running = false;
  return results;
}
