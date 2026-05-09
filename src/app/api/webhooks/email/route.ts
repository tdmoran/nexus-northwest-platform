// Provider-agnostic email webhook.
//
// Authentication precedence:
//  1. SendGrid Ed25519 signature (X-Twilio-Email-Event-Webhook-Signature) when
//     SENDGRID_WEBHOOK_PUBLIC_KEY is configured.
//  2. Svix/Resend signature (svix-id / svix-timestamp / svix-signature) when
//     RESEND_WEBHOOK_SECRET is configured.
//  3. Fallback: Authorization: Bearer ${EMAIL_WEBHOOK_SECRET}.
//
// At least one of the above must validate. Replay protection: signed payloads
// older than 5 minutes are rejected (timestamp embedded in the signed string).

import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { log } from "@/lib/logger";
import { recordBounces, type BounceEvent } from "@/server/bounces";
import { verifySendgridSignature, verifySvixSignature } from "@/lib/webhook-verify";

export const dynamic = "force-dynamic";

interface SendgridEvent {
  email?: string;
  event?: string;
  reason?: string;
  type?: string;
}

interface ResendEvent {
  type?: string;
  data?: { to?: string | string[]; email?: string; reason?: string };
}

function authoriseRequest(req: Request, rawBody: string): { ok: boolean; provider: string } {
  // Provider 1: SendGrid Ed25519
  if (env.SENDGRID_WEBHOOK_PUBLIC_KEY) {
    const sig = req.headers.get("x-twilio-email-event-webhook-signature");
    const ts = req.headers.get("x-twilio-email-event-webhook-timestamp");
    if (sig && ts) {
      const ok = verifySendgridSignature({
        publicKeyBase64: env.SENDGRID_WEBHOOK_PUBLIC_KEY,
        timestamp: ts,
        signatureBase64: sig,
        rawBody
      });
      if (ok) return { ok: true, provider: "sendgrid-signature" };
    }
  }

  // Provider 2: Svix / Resend
  if (env.RESEND_WEBHOOK_SECRET) {
    const id = req.headers.get("svix-id");
    const ts = req.headers.get("svix-timestamp");
    const sig = req.headers.get("svix-signature");
    if (id && ts && sig) {
      const ok = verifySvixSignature({
        signingSecret: env.RESEND_WEBHOOK_SECRET,
        msgId: id,
        timestamp: ts,
        signatureHeader: sig,
        rawBody
      });
      if (ok) return { ok: true, provider: "resend-svix" };
    }
  }

  // Fallback: shared bearer token
  const auth = req.headers.get("authorization") ?? "";
  if (auth === `Bearer ${env.EMAIL_WEBHOOK_SECRET}`) {
    return { ok: true, provider: "bearer" };
  }

  return { ok: false, provider: "none" };
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
  if (Array.isArray(payload)) return fromSendgrid(payload as SendgridEvent[]);
  if (payload && typeof payload === "object") return fromResend([payload as ResendEvent]);
  return [];
}

export async function POST(req: Request) {
  const rawBody = await req.text();

  const auth = authoriseRequest(req, rawBody);
  if (!auth.ok) {
    log.warn("bounce_webhook.unauthorised");
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const events = detectAndNormalise(body);
  if (events.length === 0) {
    log.info("bounce_webhook.no_actionable_events", { provider: auth.provider });
    return NextResponse.json({ ok: true, updated: 0 });
  }

  const result = await recordBounces(events);
  log.info("bounce_webhook.processed", { provider: auth.provider, ...result });
  return NextResponse.json({ ok: true, ...result });
}
