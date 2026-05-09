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
  const [scheduledFor, setScheduledFor] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const channelLabel = channel === "EMAIL" ? "email" : "WhatsApp";
    const audienceLabel = audience === "all" ? "all consenting members" : "RSVP-Yes only";
    const when = scheduledFor ? `at ${new Date(scheduledFor).toLocaleString()}` : "now";
    if (!confirm(`Send via ${channelLabel} to ${audienceLabel} ${when}?`)) return;

    setSubmitting(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`/api/events/${eventId}/announce`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audience,
          channel,
          scheduledFor: scheduledFor || null
        })
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as {
        recipientCount?: number;
        estimatedRecipients?: number;
        failedCount?: number;
        queued?: boolean;
        scheduled?: boolean;
      };
      if (data.scheduled) {
        setResult(
          `Scheduled to ~${data.estimatedRecipients ?? 0} member(s) for ${new Date(scheduledFor).toLocaleString()}.`
        );
      } else if (data.queued) {
        setResult(
          `Queued to ${data.recipientCount} member(s). Status updates as the worker dispatches.`
        );
      } else {
        setResult(
          `Sent to ${data.recipientCount ?? 0} member(s)` +
            ((data.failedCount ?? 0) > 0 ? `; ${data.failedCount} failed` : "")
        );
      }
      setScheduledFor("");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <form onSubmit={onSubmit} className="mt-3 flex flex-wrap items-center gap-3">
        <label className="flex flex-col text-xs text-slate-600">
          <span className="font-semibold uppercase tracking-wide">Channel</span>
          <select
            value={channel}
            onChange={(e) => setChannel(e.target.value as "EMAIL" | "WHATSAPP")}
            className="mt-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="EMAIL">Email</option>
            <option value="WHATSAPP" disabled={!whatsappEnabled}>
              WhatsApp{!whatsappEnabled ? " (disabled)" : ""}
            </option>
          </select>
        </label>
        <label className="flex flex-col text-xs text-slate-600">
          <span className="font-semibold uppercase tracking-wide">Audience</span>
          <select
            value={audience}
            onChange={(e) => setAudience(e.target.value as "all" | "rsvp_yes")}
            className="mt-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="all">All consenting members</option>
            <option value="rsvp_yes">RSVP &mdash; Yes only</option>
          </select>
        </label>
        <label className="flex flex-col text-xs text-slate-600">
          <span className="font-semibold uppercase tracking-wide">Schedule (optional)</span>
          <input
            type="datetime-local"
            value={scheduledFor}
            onChange={(e) => setScheduledFor(e.target.value)}
            className="mt-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        <div className="flex flex-col gap-1 self-end">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setPreviewOpen((v) => !v)}
          >
            {previewOpen ? "Hide preview" : "Preview"}
          </Button>
        </div>
        <div className="flex flex-col gap-1 self-end">
          <Button type="submit" disabled={submitting}>
            {submitting ? "Sending…" : scheduledFor ? "Schedule send" : "Send now"}
          </Button>
        </div>
        {result && (
          <span role="status" aria-live="polite" className="basis-full text-xs text-emerald-700">
            {result}
          </span>
        )}
        {error && (
          <span role="alert" aria-live="polite" className="basis-full text-xs text-red-700">
            {error}
          </span>
        )}
      </form>

      {previewOpen && (
        <div className="mt-4 overflow-hidden rounded-lg border border-slate-200">
          <iframe
            title="Announcement preview"
            src={`/api/events/${eventId}/announce/preview`}
            className="block h-[600px] w-full bg-white"
          />
        </div>
      )}
    </>
  );
}
