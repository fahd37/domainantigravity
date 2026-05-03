interface RateLimit {
  perMinute: number;
  perHour?: number;
  perDay?: number;
}

interface Bucket {
  tokens: number;
  lastRefill: number;
  minuteCount: number;
  minuteWindow: number;
  dayCount: number;
  dayWindow: number;
  hourCount: number;
  hourWindow: number;
  waiters: Array<() => void>;
}

export const LIMITS: Record<string, RateLimit> = {
  wayback:    { perMinute: 60,  perHour: 1000 },
  dataforseo: { perMinute: 60,  perDay: 5000 },
  majestic:   { perMinute: 30,  perDay: 2000 },
  namecheap:  { perMinute: 5,   perDay: 200 },
  godaddy:    { perMinute: 60,  perDay: 500 },
  google:     { perMinute: 10,  perDay: 1000 },
  wayback_content: { perMinute: 20, perHour: 200 },
};

class RateLimiter {
  private buckets: Map<string, Bucket> = new Map();
  private hitLog: Array<{ api: string; ts: number; waited: boolean }> = [];

  private getBucket(api: string): Bucket {
    if (!this.buckets.has(api)) {
      this.buckets.set(api, {
        tokens: LIMITS[api]?.perMinute ?? 60,
        lastRefill: Date.now(),
        minuteCount: 0,
        minuteWindow: Date.now(),
        dayCount: 0,
        dayWindow: Date.now(),
        hourCount: 0,
        hourWindow: Date.now(),
        waiters: [],
      });
    }
    return this.buckets.get(api)!;
  }

  private refill(api: string, bucket: Bucket) {
    const limit = LIMITS[api] || { perMinute: 60 };
    const now = Date.now();
    const elapsed = now - bucket.lastRefill;

    // Refill per minute
    if (elapsed >= 60000) {
      bucket.tokens = limit.perMinute;
      bucket.lastRefill = now;
      bucket.minuteCount = 0;
      bucket.minuteWindow = now;
      // Drain any waiters
      while (bucket.waiters.length > 0 && bucket.tokens > 0) {
        bucket.tokens--;
        bucket.waiters.shift()?.();
      }
    }

    // Reset day counter
    if (now - bucket.dayWindow >= 86400000) {
      bucket.dayCount = 0;
      bucket.dayWindow = now;
    }

    // Reset hour counter
    if (now - bucket.hourWindow >= 3600000) {
      bucket.hourCount = 0;
      bucket.hourWindow = now;
    }
  }

  /**
   * Acquire a token for the given API. Waits if limit reached.
   */
  async acquire(api: string): Promise<void> {
    const bucket = this.getBucket(api);
    const limit = LIMITS[api] || { perMinute: 60 };
    this.refill(api, bucket);

    // Check day limit
    if (limit.perDay && bucket.dayCount >= limit.perDay) {
      const msUntilMidnight = 86400000 - (Date.now() - bucket.dayWindow);
      console.warn(`[RateLimit] ${api} daily limit reached. Waiting ${Math.round(msUntilMidnight / 1000)}s`);
      this.hitLog.push({ api, ts: Date.now(), waited: true });
      await new Promise<void>(res => setTimeout(res, msUntilMidnight));
      bucket.dayCount = 0;
      bucket.dayWindow = Date.now();
    }

    // Check hour limit
    if (limit.perHour && bucket.hourCount >= limit.perHour) {
      const msUntilHour = 3600000 - (Date.now() - bucket.hourWindow);
      console.warn(`[RateLimit] ${api} hourly limit reached. Waiting ${Math.round(msUntilHour / 1000)}s`);
      this.hitLog.push({ api, ts: Date.now(), waited: true });
      await new Promise<void>(res => setTimeout(res, msUntilHour));
      bucket.hourCount = 0;
      bucket.hourWindow = Date.now();
    }

    // Check per-minute tokens
    if (bucket.tokens <= 0) {
      const msUntilRefill = 60000 - (Date.now() - bucket.lastRefill);
      this.hitLog.push({ api, ts: Date.now(), waited: true });
      await new Promise<void>(res => {
        bucket.waiters.push(res);
        setTimeout(() => {
          this.refill(api, bucket);
          const idx = bucket.waiters.indexOf(res);
          if (idx !== -1) {
            bucket.waiters.splice(idx, 1);
            res();
          }
        }, Math.max(msUntilRefill, 100));
      });
    } else {
      this.hitLog.push({ api, ts: Date.now(), waited: false });
    }

    bucket.tokens = Math.max(0, bucket.tokens - 1);
    bucket.minuteCount++;
    bucket.dayCount++;
    bucket.hourCount++;
  }

  getStatus(): Record<string, { remaining: number; minuteCount: number; dayCount: number; hourLimit?: number; dayLimit?: number }> {
    const status: Record<string, { remaining: number; minuteCount: number; dayCount: number; hourLimit?: number; dayLimit?: number }> = {};
    for (const [api, bucket] of Array.from(this.buckets.entries())) {
      this.refill(api, bucket);
      const limit = LIMITS[api] || { perMinute: 60 };
      status[api] = {
        remaining: bucket.tokens,
        minuteCount: bucket.minuteCount,
        dayCount: bucket.dayCount,
        hourLimit: limit.perHour,
        dayLimit: limit.perDay,
      };
    }
    return status;
  }

  getHitRate(api: string, windowMs = 60000): { total: number; throttled: number } {
    const cutoff = Date.now() - windowMs;
    const recent = this.hitLog.filter(h => h.api === api && h.ts >= cutoff);
    return { total: recent.length, throttled: recent.filter(h => h.waited).length };
  }

  // Clean up old log entries (keep last 10min)
  pruneLog() {
    const cutoff = Date.now() - 600000;
    this.hitLog = this.hitLog.filter(h => h.ts >= cutoff);
  }
}

// Singleton
export const rateLimiter = new RateLimiter();
setInterval(() => rateLimiter.pruneLog(), 300000); // clean every 5min
