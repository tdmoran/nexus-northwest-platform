import { env } from "@/lib/env";

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

const baseLayout = (title: string, body: string, preferencesUrl: string, unsubscribeUrl: string) => `
<!doctype html>
<html><head><meta charset="utf-8"/><title>${escapeHtml(title)}</title></head>
<body style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif; max-width: 640px; margin: 0 auto; padding: 24px; color: #0f1b46; background:#fafafa">
  <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:24px">
    <h1 style="font-size:20px;color:#1f3585;margin:0 0 16px 0">${escapeHtml(env.NEXT_PUBLIC_SITE_NAME)}</h1>
    ${body}
  </div>
  <p style="font-size:12px;color:#64748b;text-align:center;margin-top:16px">
    <a href="${preferencesUrl}" style="color:#2a46ac">Manage preferences</a> &middot;
    <a href="${unsubscribeUrl}" style="color:#2a46ac">Unsubscribe</a>
  </p>
</body></html>
`;

export function welcomeEmail(v: WelcomeEmailVars) {
  const broadcast = env.WHATSAPP_BROADCAST_GROUP_URL;
  const discussion = env.WHATSAPP_DISCUSSION_GROUP_URL;

  const inner = `
    <p>Hi ${escapeHtml(v.name)},</p>
    <p>It takes effort to get people&rsquo;s attention these days, so know this &mdash; we really appreciate and value you taking the time to be part of <strong>Nexus Northwest</strong>. We&rsquo;ll make every effort to be efficient and effective with our communication.</p>
    <p>By default you will receive an email every time an event is announced (and a reminder or two as the event approaches).</p>
    ${broadcast ? `<p>If you would like a WhatsApp notification announcing any upcoming event, please join this <a href="${broadcast}">broadcast-only WhatsApp group</a> (zero spam).</p>` : ""}
    ${discussion ? `<p>If you want to get stuck into sharing and discussing the latest trends, you can <a href="${discussion}">join the members discussion group</a>.</p>` : ""}
    <p>You can <a href="${v.preferencesUrl}">manage your communication preferences</a> at any time.</p>
    <p>Looking forward to meeting in person at the next event.<br/>Kind regards,<br/>The Nexus Northwest team</p>
  `;

  return {
    subject: `Welcome to ${env.NEXT_PUBLIC_SITE_NAME}`,
    html: baseLayout(`Welcome to ${env.NEXT_PUBLIC_SITE_NAME}`, inner, v.preferencesUrl, v.unsubscribeUrl)
  };
}

export function announcementEmail(v: AnnouncementEmailVars) {
  const button = (url: string, label: string, color: string) => `
    <a href="${url}" style="display:inline-block;padding:12px 18px;border-radius:8px;background:${color};color:#fff;text-decoration:none;font-weight:600;margin-right:8px">${label}</a>
  `;

  const inner = `
    <p>Hi ${escapeHtml(v.memberName)},</p>
    ${v.heroImageUrl ? `<img src="${v.heroImageUrl}" alt="" style="width:100%;border-radius:8px;margin:8px 0" />` : ""}
    <h2 style="font-size:18px;margin:8px 0">${escapeHtml(v.eventTitle)}</h2>
    <p style="margin:4px 0"><strong>When:</strong> ${escapeHtml(v.eventDate)}</p>
    <p style="margin:4px 0"><strong>Where:</strong> ${escapeHtml(v.eventLocation)}</p>
    <div style="margin:12px 0;line-height:1.5">${v.description}</div>
    <div style="margin:16px 0">
      ${button(v.rsvpYesUrl, "RSVP Yes", "#16a34a")}
      ${button(v.rsvpMaybeUrl, "Maybe", "#ca8a04")}
      ${button(v.rsvpNoUrl, "No", "#dc2626")}
    </div>
    <p style="font-size:12px;color:#64748b">One click is all it takes &mdash; no login required.</p>
  `;

  return {
    subject: v.eventTitle,
    html: baseLayout(v.eventTitle, inner, v.preferencesUrl, v.unsubscribeUrl)
  };
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
