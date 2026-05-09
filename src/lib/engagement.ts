// Engagement scoring.
//
// Inputs: RSVP rows for a member (limited to past events).
// Score = sum of:
//   - 1 point per RSVP (Yes/Maybe/No — they engaged enough to respond)
//   - 2 extra points if YES
//   - 5 extra points if attendedAt is set
//   - -1 penalty if noShow=true (RSVPed Yes then didn't show)
// Capped at 0 floor.

interface ScoreInput {
  status: "YES" | "NO" | "MAYBE" | "CANCELLED" | "WAITLISTED";
  attendedAt: Date | null;
  noShow: boolean;
}

export function engagementScore(rsvps: ScoreInput[]): {
  score: number;
  rsvpCount: number;
  yesCount: number;
  attendedCount: number;
  noShowCount: number;
} {
  let score = 0;
  let rsvpCount = 0;
  let yesCount = 0;
  let attendedCount = 0;
  let noShowCount = 0;

  for (const r of rsvps) {
    if (r.status === "CANCELLED") continue;
    rsvpCount++;
    score += 1;
    if (r.status === "YES") {
      yesCount++;
      score += 2;
    }
    if (r.attendedAt) {
      attendedCount++;
      score += 5;
    }
    if (r.noShow) {
      noShowCount++;
      score -= 1;
    }
  }
  return {
    score: Math.max(0, score),
    rsvpCount,
    yesCount,
    attendedCount,
    noShowCount
  };
}

export function engagementBand(score: number): "active" | "engaged" | "occasional" | "lapsed" {
  if (score >= 30) return "active";
  if (score >= 12) return "engaged";
  if (score >= 3) return "occasional";
  return "lapsed";
}
