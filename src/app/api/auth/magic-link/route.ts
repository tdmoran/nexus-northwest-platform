import { NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit, clientIpFrom } from "@/lib/rate-limit";
import { requestMagicLink } from "@/server/magic-link";

const bodySchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254)
});

const RATE_LIMIT = { limit: 5, windowMs: 60 * 1000 } as const;

export async function POST(req: Request) {
  const ip = clientIpFrom(req.headers);
  const limit = await rateLimit({ key: `magic:${ip}`, ...RATE_LIMIT });
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please wait before trying again." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed" }, { status: 422 });
  }

  // Always return ok — never reveal whether the email is on the organiser list.
  await requestMagicLink({ email: parsed.data.email, ip });
  return NextResponse.json({ ok: true });
}
