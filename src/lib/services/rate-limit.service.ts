import Redis from "ioredis";

interface WindowRecord {
  count: number;
  resetAt: number;
}

class InMemoryRateLimiter {
  private buckets = new Map<string, WindowRecord>();

  async check(key: string, limit: number, windowMs: number): Promise<boolean> {
    const now = Date.now();
    const current = this.buckets.get(key);
    if (!current || current.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + windowMs });
      return true;
    }
    if (current.count >= limit) {
      return false;
    }
    current.count += 1;
    return true;
  }
}

class RedisRateLimiter {
  private client: Redis | null = null;

  constructor(url: string) {
    this.client = new Redis(url, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    });
  }

  async check(key: string, limit: number, windowMs: number): Promise<boolean> {
    if (!this.client) return true;
    try {
      const redisKey = `ratelimit:${key}`;
      const count = await this.client.incr(redisKey);
      if (count === 1) {
        await this.client.expire(redisKey, Math.ceil(windowMs / 1000));
      }
      return count <= limit;
    } catch {
      return true;
    }
  }
}

const memory = new InMemoryRateLimiter();
const redisUrl = process.env.REDIS_URL;
const redisLimiter = redisUrl ? new RedisRateLimiter(redisUrl) : null;

export async function rateLimitCheck(
  endpoint: string,
  key: string,
  limit: number,
  windowMs: number,
): Promise<boolean> {
  if (process.env.RATE_LIMIT_ENABLED === "false") return true;
  const limiter = redisLimiter ?? memory;
  return limiter.check(`ratelimit:${endpoint}:${key}`, limit, windowMs);
}
