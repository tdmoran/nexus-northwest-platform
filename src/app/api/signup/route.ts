import { NextResponse } from "next/server";
import { signupSchema } from "@/lib/validation";
import { signupMember } from "@/server/members";
import { log } from "@/lib/logger";
import { rateLimit, clientIpFrom } from "@/lib/rate-limit";

const RATE_LIMIT = { limit: 5, windowMs: 60 * 1000 } as const;

export async function POST(req: Request) {
  const ip = clientIpFrom(req.headers);
  const limit = await rateLimit({ key: `signup:${ip}`, ...RATE_LIMIT });
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many sign-up attempts. Please try again shortly." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = signupSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 }
    );
  }

  // Honeypot: if a bot filled the field, return 201 with no work done so they
  // don't learn the field was the trap.
  if (parsed.data.website && parsed.data.website.length > 0) {
    log.warn("signup.honeypot.tripped", { ip });
    return NextResponse.json({ ok: true, memberId: "honeypot", created: false }, { status: 201 });
  }

  try {
    const { memberId, created } = await signupMember(parsed.data);
    return NextResponse.json({ ok: true, memberId, created }, { status: 201 });
  } catch (err) {
    log.error("signup.failed", { err: String(err) });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
