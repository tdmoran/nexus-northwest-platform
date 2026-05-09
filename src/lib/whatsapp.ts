// WhatsApp Business Cloud API integration boundary.
//
// When WHATSAPP_ENABLED=false (default) the integration is a no-op stub that
// just returns success with a fake provider id, so flows can be exercised
// without a Meta account.
//
// When enabled it sends a template message via the Graph API. Templates must
// be pre-approved in Meta Business Manager. The default template is
// `event_announcement` with body parameters in this order:
//   {{1}} member name
//   {{2}} event title
//   {{3}} event date (human readable)
//   {{4}} event location
//   {{5}} RSVP-Yes URL
// Adjust to match your approved template.

import { env } from "@/lib/env";
import { log } from "@/lib/logger";

export interface WhatsAppSendArgs {
  toPhone: string;                 // E.164, no plus sign or with — Meta accepts both
  templateName?: string;           // overrides env default
  language?: string;
  variables: string[];             // body parameter values, in order
}

export interface WhatsAppSendResult {
  ok: boolean;
  providerId: string | null;
  skipped: boolean;
  error?: string;
}

function normalisePhone(raw: string): string {
  return raw.replace(/[^\d]/g, "");
}

async function sendReal(args: WhatsAppSendArgs): Promise<WhatsAppSendResult> {
  const url = `https://graph.facebook.com/${env.WHATSAPP_GRAPH_VERSION}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
  const body = {
    messaging_product: "whatsapp",
    to: normalisePhone(args.toPhone),
    type: "template",
    template: {
      name: args.templateName ?? env.WHATSAPP_TEMPLATE_NAME,
      language: { code: args.language ?? env.WHATSAPP_TEMPLATE_LANGUAGE },
      components: [
        {
          type: "body",
          parameters: args.variables.map((v) => ({ type: "text", text: v }))
        }
      ]
    }
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const text = await res.text();
    return { ok: false, providerId: null, skipped: false, error: `whatsapp:${res.status} ${text}` };
  }
  const data = (await res.json()) as { messages?: Array<{ id?: string }> };
  return {
    ok: true,
    providerId: data.messages?.[0]?.id ?? null,
    skipped: false
  };
}

export async function sendWhatsAppTemplate(args: WhatsAppSendArgs): Promise<WhatsAppSendResult> {
  if (!env.WHATSAPP_ENABLED) {
    log.info("whatsapp.stub.skip", { toPhone: args.toPhone });
    return { ok: true, providerId: null, skipped: true };
  }
  if (!env.WHATSAPP_ACCESS_TOKEN || !env.WHATSAPP_PHONE_NUMBER_ID) {
    return {
      ok: false,
      providerId: null,
      skipped: false,
      error: "WhatsApp credentials not configured"
    };
  }
  try {
    return await sendReal(args);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error("whatsapp.send.failed", { err: message });
    return { ok: false, providerId: null, skipped: false, error: message };
  }
}
