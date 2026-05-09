// WhatsApp Business webhook.
//
// GET handles Meta's subscription handshake (`hub.mode=subscribe`).
// POST handles status receipts (sent/delivered/read/failed) keyed by `wamid`,
// and inbound messages from members. We watch for STOP / UNSUBSCRIBE keywords
// to honour opt-outs across the channel (spec §7.3).

import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { log } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const STOP_KEYWORDS = new Set(["stop", "unsubscribe", "stopall", "leave", "quit"]);

interface WaStatus {
  id?: string; // wamid
  status?: "sent" | "delivered" | "read" | "failed";
  recipient_id?: string;
  errors?: Array<{ code?: number | string; title?: string; message?: string }>;
}

interface WaMessage {
  from?: string;          // sender phone
  text?: { body?: string };
  type?: string;
}

interface WaChange {
  value?: {
    statuses?: WaStatus[];
    messages?: WaMessage[];
  };
}

interface WaPayload {
  entry?: Array<{ changes?: WaChange[] }>;
}

export async function GET(req: Request) {
  // Subscription handshake.
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  if (mode === "subscribe" && token === env.WHATSAPP_VERIFY_TOKEN && challenge) {
    return new NextResponse(challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain" }
    });
  }
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export async function POST(req: Request) {
  let payload: WaPayload;
  try {
    payload = (await req.json()) as WaPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  let statuses = 0;
  let inbound = 0;
  let stopHandled = 0;

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const status of change.value?.statuses ?? []) {
        statuses++;
        await applyStatus(status);
      }
      for (const msg of change.value?.messages ?? []) {
        inbound++;
        if (await applyInboundMessage(msg)) stopHandled++;
      }
    }
  }

  log.info("whatsapp_webhook.processed", { statuses, inbound, stopHandled });
  return NextResponse.json({ ok: true, statuses, inbound, stopHandled });
}

async function applyStatus(s: WaStatus): Promise<void> {
  if (!s.id) return;
  const existing = await prisma.whatsAppMessage.findUnique({ where: { providerId: s.id } });
  if (!existing) return;

  const now = new Date();
  const data: Record<string, unknown> = {};
  switch (s.status) {
    case "sent":
      data.status = "SENT";
      data.sentAt = existing.sentAt ?? now;
      break;
    case "delivered":
      data.status = "DELIVERED";
      data.deliveredAt = now;
      break;
    case "read":
      data.status = "READ";
      data.readAt = now;
      break;
    case "failed":
      data.status = "FAILED";
      data.errorCode = s.errors?.[0]?.code != null ? String(s.errors[0].code) : null;
      data.errorMessage = s.errors?.[0]?.message ?? s.errors?.[0]?.title ?? null;
      break;
  }
  if (Object.keys(data).length === 0) return;

  await prisma.whatsAppMessage.update({ where: { id: existing.id }, data });
}

async function applyInboundMessage(msg: WaMessage): Promise<boolean> {
  const from = msg.from?.replace(/[^\d]/g, "") ?? "";
  if (!from) return false;
  const text = (msg.text?.body ?? "").trim().toLowerCase();
  if (!STOP_KEYWORDS.has(text)) return false;

  // Match either the WhatsApp number or the phone, allowing the leading-zero
  // / +country variants. Compare on digit-only suffix to be tolerant.
  const tail = from.slice(-9);
  const candidates = await prisma.member.findMany({
    where: {
      OR: [
        { whatsappNumber: { endsWith: tail } },
        { phone: { endsWith: tail } }
      ]
    }
  });
  if (candidates.length === 0) {
    log.warn("whatsapp.stop.unmatched", { from });
    return false;
  }

  const now = new Date();
  for (const m of candidates) {
    await prisma.member.update({
      where: { id: m.id },
      data: { whatsappConsent: false, whatsappOptOutAt: now }
    });
    await audit({
      action: "whatsapp.opt_out",
      memberId: m.id,
      channel: "whatsapp",
      meta: { keyword: text, from }
    });
  }
  return true;
}
