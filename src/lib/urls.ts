import { env } from "@/lib/env";

export function publicUrl(path: string): string {
  const base = env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${base}${suffix}`;
}

export function rsvpUrl(token: string, status: "yes" | "no" | "maybe"): string {
  return publicUrl(`/rsvp/${encodeURIComponent(token)}?response=${status}`);
}

export function preferencesUrl(token: string): string {
  return publicUrl(`/preferences/${encodeURIComponent(token)}`);
}

export function unsubscribeUrl(token: string): string {
  return publicUrl(`/unsubscribe/${encodeURIComponent(token)}`);
}
