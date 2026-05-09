// Pluggable rate limiter. The default backend is process-local (sliding-window
// in a Map) which is perfect for single-instance deployments and tests.
//
// When REDIS_URL is set, an ioredis-backed fixed-window backend is used so all
// app instances share counters. ioredis is an optional dependency so single-
// instance setups don't pay for it.
//
// API:
//   await rateLimit({ key, limit, windowMs }) -> { ok, remaining, retryAfterSeconds }

import { env } from "@/lib/env";
import { log } from "@/lib/logger";

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export interface RateLimitOptions {
  key: string;
  limit: number;
  windowMs: number;
}

interface RateLimiter {
  check(opts: RateLimitOptions): Promise<RateLimitResult>;
  reset(): Promise<void>;
}

// ----- In-memory backend -----

class InMemoryLimiter implements RateLimiter {
  private buckets = new Map<string, { count: number; expiresAt: number }>();
  private lastSweep = 0;

  private sweep(now: number): void {
    if (now - this.lastSweep < 60_000) return;
    this.lastSweep = now;
    for (const [k, s] of this.buckets) {
      if (s.expiresAt <= now) this.buckets.delete(k);
    }
  }

  async check(opts: RateLimitOptions): Promise<RateLimitResult> {
    const now = Date.now();
    this.sweep(now);
    const state = this.buckets.get(opts.key);
    if (!state || state.expiresAt <= now) {
      this.buckets.set(opts.key, { count: 1, expiresAt: now + opts.windowMs });
      return { ok: true, remaining: opts.limit - 1, retryAfterSeconds: 0 };
    }
    if (state.count >= opts.limit) {
      return {
        ok: false,
        remaining: 0,
        retryAfterSeconds: Math.max(1, Math.ceil((state.expiresAt - now) / 1000))
      };
    }
    state.count += 1;
    return { ok: true, remaining: opts.limit - state.count, retryAfterSeconds: 0 };
  }

  async reset(): Promise<void> {
    this.buckets.clear();
    this.lastSweep = 0;
  }
}

// ----- Redis backend (loaded lazily) -----

class RedisLimiter implements RateLimiter {
  private clientPromise: Promise<unknown> | null = null;

  private async client(): Promise<{
    incr: (key: string) => Promise<number>;
    pexpire: (key: string, ms: number) => Promise<number>;
    pttl: (key: string) => Promise<number>;
    flushdb: () => Promise<unknown>;
  }> {
    if (!this.clientPromise) {
      this.clientPromise = import("ioredis").then(({ default: Redis }) => new Redis(env.REDIS_URL));
    }
    return this.clientPromise as Promise<never>;
  }

  async check(opts: RateLimitOptions): Promise<RateLimitResult> {
    try {
      const redis = await this.client();
      const count = await redis.incr(opts.key);
      if (count === 1) await redis.pexpire(opts.key, opts.windowMs);
      if (count > opts.limit) {
        const ttl = await redis.pttl(opts.key);
        return {
          ok: false,
          remaining: 0,
          retryAfterSeconds: ttl > 0 ? Math.ceil(ttl / 1000) : Math.ceil(opts.windowMs / 1000)
        };
      }
      return { ok: true, remaining: opts.limit - count, retryAfterSeconds: 0 };
    } catch (err) {
      // Fail-open if Redis is unreachable. The in-memory limiter will catch
      // the worst offenders on each instance, and we'd rather not block real
      // sign-ups during an outage.
      log.error("rate_limit.redis_failed", { err: String(err) });
      return { ok: true, remaining: opts.limit, retryAfterSeconds: 0 };
    }
  }

  async reset(): Promise<void> {
    // Only used by tests, where Redis isn't configured.
    const redis = await this.client();
    await redis.flushdb();
  }
}

// ----- Choice + public API -----

const limiter: RateLimiter = env.REDIS_URL ? new RedisLimiter() : new InMemoryLimiter();

export async function rateLimit(opts: RateLimitOptions): Promise<RateLimitResult> {
  return limiter.check(opts);
}

export async function _resetRateLimitForTests(): Promise<void> {
  await limiter.reset();
}

export function clientIpFrom(headers: Headers): string {
  const xff = headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return headers.get("x-real-ip") ?? "unknown";
}
