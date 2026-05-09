// Process-local sliding-window rate limiter. Sufficient for single-instance
// deployments. Multi-instance deployments should swap this for a Redis-backed
// implementation (the API surface stays the same).

interface WindowState {
  count: number;
  expiresAt: number;
}

const buckets = new Map<string, WindowState>();
const SWEEP_EVERY_MS = 60_000;
let lastSweep = 0;

function sweep(now: number): void {
  if (now - lastSweep < SWEEP_EVERY_MS) return;
  lastSweep = now;
  for (const [key, state] of buckets.entries()) {
    if (state.expiresAt <= now) buckets.delete(key);
  }
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export function rateLimit(opts: {
  key: string;
  limit: number;
  windowMs: number;
}): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const state = buckets.get(opts.key);
  if (!state || state.expiresAt <= now) {
    buckets.set(opts.key, { count: 1, expiresAt: now + opts.windowMs });
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

// Used by tests to reset between cases.
export function _resetRateLimitForTests(): void {
  buckets.clear();
  lastSweep = 0;
}

export function clientIpFrom(headers: Headers): string {
  // Trust standard reverse-proxy headers; pick the first IP from x-forwarded-for.
  const xff = headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return headers.get("x-real-ip") ?? "unknown";
}
