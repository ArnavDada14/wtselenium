import { LRUCache } from 'lru-cache';

/**
 * Simple in-memory LRU cache for catalog queries.
 * Replaces Redis for read-caching at college-scale load.
 *
 * Default TTL: 5 minutes (300_000 ms)
 * Max entries:  500 (covers catalog pagination with comfortable headroom)
 *
 * Invalidation: explicit key deletion on mutations (book create/update, copy status change)
 */

const cache = new LRUCache<string, object>({
  max: 500,
  ttl: 1000 * 60 * 5,
});

export function cacheGet<T>(key: string): T | undefined {
  return cache.get(key) as T | undefined;
}

export function cacheSet<T extends object>(key: string, value: T, ttlMs?: number): void {
  cache.set(key, value, ttlMs ? { ttl: ttlMs } : undefined);
}

export function cacheDelete(key: string): void {
  cache.delete(key);
}

export function cacheDeleteByPrefix(prefix: string): void {
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) {
      cache.delete(key);
    }
  }
}
