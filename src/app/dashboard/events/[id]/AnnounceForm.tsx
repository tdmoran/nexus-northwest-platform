"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

export function AnnounceForm({
  eventId,
  whatsappEnabled
}: {
  eventId: string;
  whatsappEnabled: boolean;
}) {
  const router = useRouter();
  const [audience, setAudience] = useState<"all" | "rsvp_yes">("all");
  const [channel, setChannel] = useState<"EMAIL" | "WHATSAPP">("EMAIL");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const channelLabel = channel === "EMAIL" ? "email" : "WhatsApp";
    const audienceLabel = audience === "all" ? "all consenting members" : "RSVP-Yes only";
    if (!confirm(`Send via ${channelLabel} to ${audienceLabel}?`)) return;

    setSubmitting(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`/api/events/${eventId}/announce`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audience, channel })
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as {
        recipientCount: number;
        failedCount: number;
        queued?: boolean;
      };
      if (data.queued) {
        setResult(
          `Queued to ${data.recipientCount} member(s). Status updates as the worker dispatches.`
        );
      } else {
        setResult(
          `Sent to ${data.recipientCount} member(s)` +
            (data.failedCount > 0 ? `; ${data.failedCount} failed` : "")
        );
      }
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-3 flex flex-wrap items-center gap-3">
      <select
        value={channel}
        onChange={(e) => setChannel(e.target.value as "EMAIL" | "WHATSAPP")}
        className="rounded-md border border-slate-300 px-3 py-2 text-sm"
      >
        <option value="EMAIL">Email</option>
        <option value="WHATSAPP" disabled={!whatsappEnabled}>
          WhatsApp{!whatsappEnabled ? " (disabled — set WHATSAPP_ENABLED=true)" : ""}
        </option>
      </select>
      <select
        value={audience}
        onChange={(e) => setAudience(e.target.value as "all" | "rsvp_yes")}
        className="rounded-md border border-slate-300 px-3 py-2 text-sm"
      >
        <option value="all">All consenting members</option>
        <option value="rsvp_yes">RSVP &mdash; Yes only</option>
      </select>
      <Button type="submit" disabled={submitting}>
        {submitting ? "Sending..." : "Send announcement"}
      </Button>
      {result && <span className="text-xs text-emerald-700">{result}</span>}
      {error && <span className="text-xs text-red-700">{error}</span>}
    </form>
  );
}
