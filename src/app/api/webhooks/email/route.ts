// Provider-agnostic email webhook.
//
// Both SendGrid and Resend post JSON arrays of events. We accept either shape,
// translate to a normalised BounceEvent[], and update member consent flags.
// Authenticate via Authorization: Bearer ${EMAIL_WEBHOOK_SECRET}.
//
// Notes:
// - Real production should verify provider-specific HMAC signatures (e.g.
//   `X-Twilio-Email-Event-Webhook-Signature` for SendGrid). The bearer-token
//   layer here is the simplest baseline and is upgraded by setting webhook
//   secrets per provider and adding signature verification.

import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { log } from "@/lib/logger";
import { recordBounces, type BounceEvent } from "@/server/bounces";

export const dynamic = "force-dynamic";

interface SendgridEvent {
  email?: string;
  event?: string;        // "bounce" | "dropped" | "spamreport" | "unsubscribe" | ...
  reason?: string;
  type?: string;         // "blocked" | "bounce"
}

interface ResendEvent {
  type?: string;         // "email.bounced" | "email.complained" | "email.delivered" | ...
  data?: { to?: string | string[]; email?: string; reason?: string };
}

function authorised(req: Request): boolean {
  const header = req.headers.get("authorization") ?? "";
  return header === `Bearer ${env.EMAIL_WEBHOOK_SECRET}`;
}

function fromSendgrid(events: SendgridEvent[]): BounceEvent[] {
  const out: BounceEvent[] = [];
  for (const e of events) {
    if (!e.email) continue;
    const ev = (e.event ?? e.type ?? "").toLowerCase();
    if (ev === "bounce" || ev === "dropped" || ev === "blocked") {
      out.push({ email: e.email, kind: "bounce", reason: e.reason, provider: "sendgrid" });
    } else if (ev === "spamreport") {
      out.push({ email: e.email, kind: "complaint", reason: e.reason, provider: "sendgrid" });
    } else if (ev === "unsubscribe" || ev === "group_unsubscribe") {
      out.push({ email: e.email, kind: "unsubscribe", reason: e.reason, provider: "sendgrid" });
    }
  }
  return out;
}

function fromResend(events: ResendEvent[]): BounceEvent[] {
  const out: BounceEvent[] = [];
  for (const e of events) {
    const t = (e.type ?? "").toLowerCase();
    const to = Array.isArray(e.data?.to) ? e.data!.to[0] : (e.data?.to ?? e.data?.email);
    if (!to) continue;
    if (t === "email.bounced") {
      out.push({ email: to, kind: "bounce", reason: e.data?.reason, provider: "resend" });
    } else if (t === "email.complained") {
      out.push({ email: to, kind: "complaint", reason: e.data?.reason, provider: "resend" });
    }
  }
  return out;
}

function detectAndNormalise(payload: unknown): BounceEvent[] {
  if (Array.isArray(payload)) {
    // SendGrid sends a top-level array of events.
    return fromSendgrid(payload as SendgridEvent[]);
  }
  if (payload && typeof payload === "object") {
    // Resend sends a single event object per call.
    return fromResend([payload as ResendEvent]);
  }
  return [];
}

export async function POST(req: Request) {
  if (!authorised(req)) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const events = detectAndNormalise(body);
  if (events.length === 0) {
    log.info("bounce_webhook.no_actionable_events");
    return NextResponse.json({ ok: true, updated: 0 });
  }

  const result = await recordBounces(events);
  return NextResponse.json({ ok: true, ...result });
}
