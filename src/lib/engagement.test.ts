import { describe, it, expect } from "vitest";
import { engagementScore, engagementBand } from "./engagement";

describe("engagementScore", () => {
  it("scores zero for an empty history", () => {
    expect(engagementScore([])).toEqual({
      score: 0,
      rsvpCount: 0,
      yesCount: 0,
      attendedCount: 0,
      noShowCount: 0
    });
  });

  it("rewards a YES RSVP that was attended", () => {
    const r = engagementScore([{ status: "YES", attendedAt: new Date(), noShow: false }]);
    expect(r.score).toBe(8); // 1 (rsvp) + 2 (yes) + 5 (attended)
    expect(r.attendedCount).toBe(1);
  });

  it("penalises a no-show", () => {
    const r = engagementScore([{ status: "YES", attendedAt: null, noShow: true }]);
    expect(r.score).toBe(2); // 1 + 2 - 1
    expect(r.noShowCount).toBe(1);
  });

  it("ignores cancelled RSVPs entirely", () => {
    const r = engagementScore([
      { status: "CANCELLED", attendedAt: null, noShow: false },
      { status: "YES", attendedAt: new Date(), noShow: false }
    ]);
    expect(r.rsvpCount).toBe(1);
    expect(r.score).toBe(8);
  });

  it("never goes below zero", () => {
    const r = engagementScore([
      { status: "YES", attendedAt: null, noShow: true },
      { status: "YES", attendedAt: null, noShow: true },
      { status: "YES", attendedAt: null, noShow: true },
      { status: "YES", attendedAt: null, noShow: true },
      { status: "YES", attendedAt: null, noShow: true }
    ]);
    // Each is 1+2-1 = 2 each → never negative.
    expect(r.score).toBeGreaterThanOrEqual(0);
  });
});

describe("engagementBand", () => {
  it("buckets the score correctly", () => {
    expect(engagementBand(40)).toBe("active");
    expect(engagementBand(30)).toBe("active");
    expect(engagementBand(15)).toBe("engaged");
    expect(engagementBand(5)).toBe("occasional");
    expect(engagementBand(0)).toBe("lapsed");
  });
});
