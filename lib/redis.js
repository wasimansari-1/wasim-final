// lib/redis.js
import Redis from "ioredis";

const REDIS_URL = process.env.REDIS_URL || process.env.REDIS_URI || "redis://127.0.0.1:6379";

// In-Memory Fallback Cache Map in case Redis is not available
class MemoryCache {
  constructor() {
    this.store = new Map();
  }

  get(key) {
    const item = this.store.get(key);
    if (!item) return null;
    if (item.expiresAt && Date.now() > item.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return item.value;
  }

  set(key, value, ttlSeconds = 60) {
    const expiresAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : null;
    this.store.set(key, { value, expiresAt });
    // Limit memory store to 2000 items
    if (this.store.size > 2000) {
      const firstKey = this.store.keys().next().value;
      if (firstKey) this.store.delete(firstKey);
    }
  }

  del(key) {
    this.store.delete(key);
  }

  delPattern(pattern) {
    const regex = new RegExp("^" + pattern.replace(/\*/g, ".*") + "$");
    for (const key of this.store.keys()) {
      if (regex.test(key)) {
        this.store.delete(key);
      }
    }
  }
}

const memoryCache = new MemoryCache();

let redisClient = null;
let isRedisAvailable = false;

try {
  redisClient = new Redis(REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    connectTimeout: 2500,
    enableOfflineQueue: false,
    retryStrategy(times) {
      if (times > 3) return null; // stop reconnecting after 3 tries and use memory fallback
      return Math.min(times * 100, 1000);
    },
  });

  redisClient.on("connect", () => {
    isRedisAvailable = true;
    console.log("⚡ [Redis] Connected successfully to", REDIS_URL.split("@").pop());
  });

  redisClient.on("error", (err) => {
    isRedisAvailable = false;
    // Suppress connection errors gracefully
    if (process.env.NODE_ENV === "development") {
      // quiet in dev fallback
    }
  });

  // Attempt initial non-blocking connection
  redisClient.connect().catch(() => {
    isRedisAvailable = false;
  });
} catch (err) {
  isRedisAvailable = false;
}

/**
 * Get cached JSON value
 */
export async function getCache(key) {
  try {
    if (isRedisAvailable && redisClient) {
      const data = await redisClient.get(key);
      if (data) return JSON.parse(data);
    }
  } catch (err) {
    // Fall back to memory
  }
  return memoryCache.get(key) || null;
}

/**
 * Set cached JSON value with TTL (seconds)
 */
export async function setCache(key, value, ttlSeconds = 60) {
  try {
    const serialized = JSON.stringify(value);
    if (isRedisAvailable && redisClient) {
      if (ttlSeconds) {
        await redisClient.set(key, serialized, "EX", ttlSeconds);
      } else {
        await redisClient.set(key, serialized);
      }
    }
  } catch (err) {
    // Fall back to memory
  }
  memoryCache.set(key, value, ttlSeconds);
}

/**
 * Delete a specific cached key
 */
export async function delCache(key) {
  try {
    if (isRedisAvailable && redisClient) {
      await redisClient.del(key);
    }
  } catch (err) {}
  memoryCache.del(key);
}

/**
 * Invalidate all keys matching a pattern (e.g. "tech:calls:*")
 */
export async function delPattern(pattern) {
  try {
    if (isRedisAvailable && redisClient) {
      let cursor = "0";
      do {
        const [nextCursor, keys] = await redisClient.scan(cursor, "MATCH", pattern, "COUNT", 100);
        cursor = nextCursor;
        if (keys && keys.length > 0) {
          await redisClient.del(...keys);
        }
      } while (cursor !== "0");
    }
  } catch (err) {}
  memoryCache.delPattern(pattern);
}

/**
 * Smart Cache Wrapper: returns cached value or executes fetcher and saves to cache
 */
export async function cached(key, ttlSeconds, fetcherFn) {
  const cachedVal = await getCache(key);
  if (cachedVal !== null && cachedVal !== undefined) {
    return cachedVal;
  }
  const freshVal = await fetcherFn();
  if (freshVal !== null && freshVal !== undefined) {
    await setCache(key, freshVal, ttlSeconds);
  }
  return freshVal;
}

export default {
  getCache,
  setCache,
  delCache,
  delPattern,
  cached,
  client: redisClient,
};
