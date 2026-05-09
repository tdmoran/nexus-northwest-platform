import { describe, it, expect, beforeEach } from "vitest";
import { rateLimit, _resetRateLimitForTests, clientIpFrom } from "./rate-limit";

describe("rateLimit", () => {
  beforeEach(() => _resetRateLimitForTests());

  it("allows requests up to the limit", () => {
    for (let i = 0; i < 3; i++) {
      const r = rateLimit({ key: "ip:1.2.3.4", limit: 3, windowMs: 60_000 });
      expect(r.ok).toBe(true);
      expect(r.remaining).toBe(2 - i);
    }
  });

  it("blocks requests above the limit and reports retry-after", () => {
    for (let i = 0; i < 2; i++) rateLimit({ key: "k", limit: 2, windowMs: 60_000 });
    const r = rateLimit({ key: "k", limit: 2, windowMs: 60_000 });
    expect(r.ok).toBe(false);
    expect(r.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("isolates by key", () => {
    rateLimit({ key: "a", limit: 1, windowMs: 60_000 });
    const otherKey = rateLimit({ key: "b", limit: 1, windowMs: 60_000 });
    expect(otherKey.ok).toBe(true);
  });

  it("resets after the window expires", async () => {
    rateLimit({ key: "k", limit: 1, windowMs: 1 });
    rateLimit({ key: "k", limit: 1, windowMs: 1 }); // hits cap
    await new Promise((r) => setTimeout(r, 5));
    const r = rateLimit({ key: "k", limit: 1, windowMs: 1 });
    expect(r.ok).toBe(true);
  });
});

describe("clientIpFrom", () => {
  it("uses x-forwarded-for first IP", () => {
    const h = new Headers({ "x-forwarded-for": "1.2.3.4, 10.0.0.1" });
    expect(clientIpFrom(h)).toBe("1.2.3.4");
  });

  it("falls back to x-real-ip", () => {
    const h = new Headers({ "x-real-ip": "5.6.7.8" });
    expect(clientIpFrom(h)).toBe("5.6.7.8");
  });

  it("returns 'unknown' when no headers are present", () => {
    expect(clientIpFrom(new Headers())).toBe("unknown");
  });
});
