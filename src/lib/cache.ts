import { prisma } from "./prisma";

// TTL config per cache type (ms)
export const CACHE_TTL = {
  wayback:      24 * 60 * 60 * 1000,   // 24 hours
  dataforseo:   72 * 60 * 60 * 1000,   // 72 hours
  majestic:      7 * 24 * 60 * 60 * 1000, // 7 days
  google:       72 * 60 * 60 * 1000,   // 72 hours
  availability: 30 * 60 * 1000,         // 30 minutes
  commoncrawl:  24 * 60 * 60 * 1000,   // 24 hours
};

// In-memory L1 cache for hot items (avoids DB hit on every call)
const memCache = new Map<string, { value: unknown; expiresAt: number }>();

function memGet<T>(key: string): T | null {
  const entry = memCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { memCache.delete(key); return null; }
  return entry.value as T;
}

function memSet(key: string, value: unknown, ttlMs: number) {
  memCache.set(key, { value, expiresAt: Date.now() + ttlMs });
  // Prevent unbounded memory growth
  if (memCache.size > 5000) {
    const oldest = Array.from(memCache.entries()).sort((a, b) => a[1].expiresAt - b[1].expiresAt)[0];
    if (oldest) memCache.delete(oldest[0]);
  }
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  // L1: memory
  const mem = memGet<T>(key);
  if (mem !== null) return mem;

  // L2: DB
  try {
    const row = await prisma.cache.findUnique({ where: { key } });
    if (!row) return null;
    if (new Date() > row.expiresAt) {
      await prisma.cache.delete({ where: { key } }).catch(() => {});
      return null;
    }
    const value = row.value as T;
    // Promote to L1
    const ttlMs = row.expiresAt.getTime() - Date.now();
    memSet(key, value, ttlMs);
    return value;
  } catch {
    return null;
  }
}

export async function cacheSet(key: string, value: unknown, ttlMs: number): Promise<void> {
  const expiresAt = new Date(Date.now() + ttlMs);
  memSet(key, value, ttlMs);

  try {
    await prisma.cache.upsert({
      where: { key },
      update: { value: value as object, expiresAt },
      create: { key, value: value as object, expiresAt },
    });
  } catch { /* DB might be unavailable — L1 cache still works */ }
}

export async function cacheDelete(key: string): Promise<void> {
  memCache.delete(key);
  await prisma.cache.delete({ where: { key } }).catch(() => {});
}

/**
 * Wrap any async function with cache.
 * Usage: const result = await withCache('wayback', domain, () => checkWayback(domain), CACHE_TTL.wayback);
 */
export async function withCache<T>(
  type: keyof typeof CACHE_TTL,
  identifier: string,
  fn: () => Promise<T>,
  customTtlMs?: number
): Promise<T> {
  const key = `${type}:${identifier}`;
  const ttlMs = customTtlMs ?? CACHE_TTL[type];

  const cached = await cacheGet<T>(key);
  if (cached !== null) return cached;

  const result = await fn();
  await cacheSet(key, result, ttlMs);
  return result;
}

/**
 * Cache statistics — hit rate over last N entries.
 */
export async function getCacheStats(): Promise<{
  totalKeys: number;
  memoryKeys: number;
  expiredCount: number;
}> {
  const totalKeys = await prisma.cache.count().catch(() => 0);
  const expiredCount = await prisma.cache.count({
    where: { expiresAt: { lt: new Date() } },
  }).catch(() => 0);

  return { totalKeys, memoryKeys: memCache.size, expiredCount };
}

/** Purge all expired cache entries (run periodically) */
export async function purgeExpiredCache(): Promise<number> {
  const result = await prisma.cache.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  }).catch(() => ({ count: 0 }));
  return result.count;
}
