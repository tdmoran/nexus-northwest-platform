// Email templates as React components rendered to static HTML synchronously.
//
// We use react-dom/server directly to keep the API synchronous (matches the
// shape every caller expects). The @react-email/components used inside are
// regular React components that produce inline-styled HTML, so this works.

import { renderToStaticMarkup } from "react-dom/server";
import { env } from "@/lib/env";
import { WelcomeEmail } from "@/emails/WelcomeEmail";
import { AnnouncementEmail } from "@/emails/AnnouncementEmail";

export interface WelcomeEmailVars {
  name: string;
  preferencesUrl: string;
  unsubscribeUrl: string;
}

export interface AnnouncementEmailVars {
  memberName: string;
  eventTitle: string;
  eventDate: string;
  eventLocation: string;
  description: string;
  rsvpYesUrl: string;
  rsvpNoUrl: string;
  rsvpMaybeUrl: string;
  preferencesUrl: string;
  unsubscribeUrl: string;
  heroImageUrl?: string | null;
}

const DOCTYPE = "<!doctype html>";

export function welcomeEmail(v: WelcomeEmailVars): { subject: string; html: string } {
  const html =
    DOCTYPE +
    renderToStaticMarkup(
      WelcomeEmail({
        brand: env.NEXT_PUBLIC_SITE_NAME,
        name: v.name,
        preferencesUrl: v.preferencesUrl,
        unsubscribeUrl: v.unsubscribeUrl,
        whatsappBroadcastUrl: env.WHATSAPP_BROADCAST_GROUP_URL || undefined,
        whatsappDiscussionUrl: env.WHATSAPP_DISCUSSION_GROUP_URL || undefined
      })
    );
  return { subject: `Welcome to ${env.NEXT_PUBLIC_SITE_NAME}`, html };
}

export function announcementEmail(v: AnnouncementEmailVars): { subject: string; html: string } {
  const html =
    DOCTYPE +
    renderToStaticMarkup(
      AnnouncementEmail({
        brand: env.NEXT_PUBLIC_SITE_NAME,
        ...v
      })
    );
  return { subject: v.eventTitle, html };
}

// Legacy export kept for callers that escape strings before composing other UIs.
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
