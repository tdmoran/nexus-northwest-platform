// Zoho CRM integration boundary.
//
// When ZOHO_ENABLED=false (default) the integration is a no-op stub that just
// returns the local member id as the "zohoId". When enabled, calls flow to
// Zoho's REST API (Leads/Contacts/CustomModule) using a refresh token to
// mint short-lived access tokens. All credentials live server-side.
//
// Field mapping is configurable via the env-driven mapping below; extend as
// needed when you wire real custom fields.

import { env } from "@/lib/env";
import { log } from "@/lib/logger";

export interface ZohoMemberPayload {
  email: string;
  name: string;
  company?: string | null;
  phone?: string | null;
  whatsappNumber?: string | null;
  signalHandle?: string | null;
  linkedinUrl?: string | null;
  preferredChannel?: string;
  emailConsent?: boolean;
  whatsappConsent?: boolean;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmContent?: string | null;
  referralCode?: string | null;
  addedByEmail?: string | null;
}

export interface ZohoSyncResult {
  zohoId: string | null;
  skipped: boolean;
}

let accessToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (accessToken && accessToken.expiresAt > Date.now() + 60_000) {
    return accessToken.token;
  }
  if (!env.ZOHO_REFRESH_TOKEN || !env.ZOHO_CLIENT_ID || !env.ZOHO_CLIENT_SECRET) {
    throw new Error("Zoho credentials not configured");
  }
  const accountsDomain = env.ZOHO_API_DOMAIN.replace("zohoapis", "accounts.zoho");
  const url = new URL(`${accountsDomain}/oauth/v2/token`);
  url.searchParams.set("refresh_token", env.ZOHO_REFRESH_TOKEN);
  url.searchParams.set("client_id", env.ZOHO_CLIENT_ID);
  url.searchParams.set("client_secret", env.ZOHO_CLIENT_SECRET);
  url.searchParams.set("grant_type", "refresh_token");
  const res = await fetch(url, { method: "POST" });
  if (!res.ok) throw new Error(`zoho:auth ${res.status}`);
  const data = (await res.json()) as { access_token: string; expires_in: number };
  accessToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000
  };
  return accessToken.token;
}

function toZohoRecord(m: ZohoMemberPayload): Record<string, unknown> {
  const [first, ...rest] = m.name.trim().split(/\s+/);
  return {
    Email: m.email,
    First_Name: first,
    Last_Name: rest.length > 0 ? rest.join(" ") : first,
    Company: m.company ?? "(self)",
    Phone: m.phone ?? null,
    WhatsApp_Number: m.whatsappNumber ?? null,
    Signal_Handle: m.signalHandle ?? null,
    LinkedIn_URL: m.linkedinUrl ?? null,
    Preferred_Communication: m.preferredChannel ?? "EMAIL",
    Email_Consent: m.emailConsent ?? true,
    WhatsApp_Consent: m.whatsappConsent ?? false,
    Lead_Source: m.utmSource ?? "Direct",
    UTM_Medium: m.utmMedium ?? null,
    UTM_Campaign: m.utmCampaign ?? null,
    UTM_Content: m.utmContent ?? null,
    Referral_Code: m.referralCode ?? null,
    Added_By: m.addedByEmail ?? null
  };
}

async function upsertReal(m: ZohoMemberPayload): Promise<ZohoSyncResult> {
  const token = await getAccessToken();
  const url = `${env.ZOHO_API_DOMAIN}/crm/v6/${env.ZOHO_MODULE}/upsert`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      data: [toZohoRecord(m)],
      duplicate_check_fields: ["Email"]
    })
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`zoho:upsert ${res.status} ${body}`);
  }
  const data = (await res.json()) as {
    data?: Array<{ details?: { id?: string } }>;
  };
  const zohoId = data.data?.[0]?.details?.id ?? null;
  return { zohoId, skipped: false };
}

export async function syncMember(payload: ZohoMemberPayload): Promise<ZohoSyncResult> {
  if (!env.ZOHO_ENABLED) {
    return { zohoId: null, skipped: true };
  }
  try {
    return await upsertReal(payload);
  } catch (err) {
    log.error("zoho.sync.failed", { err: String(err) });
    // Surface but do not break sign-up: caller may schedule a retry.
    return { zohoId: null, skipped: false };
  }
}
