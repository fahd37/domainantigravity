import { NextResponse } from "next/server";
import { SCAN_STATE } from "@/lib/processor";
import { rateLimiter, LIMITS } from "@/lib/rate-limiter";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const now = Date.now();
  const elapsedMs = SCAN_STATE.startedAt ? now - SCAN_STATE.startedAt.getTime() : 0;
  const elapsedMin = elapsedMs / 60000 || 0.001;
  const ratePerMin = elapsedMs > 0 ? Math.round(SCAN_STATE.processed / elapsedMin) : 0;
  const remaining = SCAN_STATE.total - SCAN_STATE.processed;
  const estimatedRemainingMs = ratePerMin > 0 ? (remaining / ratePerMin) * 60000 : 0;
  const passRate = SCAN_STATE.processed > 0
    ? ((SCAN_STATE.passed / SCAN_STATE.processed) * 100).toFixed(1)
    : "0.0";

  const rateLimits = rateLimiter.getStatus();

  const data = {
    running: SCAN_STATE.running,
    processed: SCAN_STATE.processed,
    total: SCAN_STATE.total,
    passed: SCAN_STATE.passed,
    failed: SCAN_STATE.failed,
    passRate,
    ratePerMin,
    estimatedRemainingMs: Math.round(estimatedRemainingMs),
    sourcesActive: SCAN_STATE.sourcesActive,
    rateLimits: Object.fromEntries(
      Object.keys(LIMITS).map(api => [
        api,
        {
          remaining: rateLimits[api]?.remaining ?? LIMITS[api].perMinute,
          dayCount: rateLimits[api]?.dayCount ?? 0,
          dayLimit: LIMITS[api].perDay,
        }
      ])
    ),
  };

  return NextResponse.json(data);
}
