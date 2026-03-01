/**
 * Simple in-memory cache with TTL support
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

/**
 * In-memory cache with time-to-live support
 */
export class Cache<T> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private defaultTtlMs: number;
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor(defaultTtlMs: number = 5 * 60 * 1000) { // 5 minutes default
    this.defaultTtlMs = defaultTtlMs;

    // Start cleanup interval
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60 * 1000); // Every minute
  }

  /**
   * Get a value from the cache
   */
  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) {
      return undefined;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.value;
  }

  /**
   * Set a value in the cache
   */
  set(key: string, value: T, ttlMs?: number): void {
    const ttl = ttlMs ?? this.defaultTtlMs;
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttl,
    });
  }

  /**
   * Check if a key exists and is not expired
   */
  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  /**
   * Delete a key from the cache
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache size
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * Remove expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Stop cleanup interval and clear cache
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.clear();
  }
}

/**
 * Generate a cache key for search results
 */
export function searchCacheKey(query: string, limit: number, source: string): string {
  return `search:${source}:${query}:${limit}`;
}

/**
 * Generate a cache key for extracted content
 */
export function extractCacheKey(url: string, formats: string[]): string {
  const sortedFormats = [...formats].sort();
  return `extract:${url}:${sortedFormats.join(',')}`;
}

// Singleton caches
let searchCache: Cache<unknown> | null = null;
let extractCache: Cache<unknown> | null = null;

/**
 * Get the search results cache
 */
export function getSearchCache(): Cache<unknown> {
  if (!searchCache) {
    searchCache = new Cache(5 * 60 * 1000); // 5 minutes
  }
  return searchCache;
}

/**
 * Get the extraction cache
 */
export function getExtractCache(): Cache<unknown> {
  if (!extractCache) {
    extractCache = new Cache(10 * 60 * 1000); // 10 minutes
  }
  return extractCache;
}

/**
 * Destroy all caches
 */
export function destroyCaches(): void {
  if (searchCache) {
    searchCache.destroy();
    searchCache = null;
  }
  if (extractCache) {
    extractCache.destroy();
    extractCache = null;
  }
}
