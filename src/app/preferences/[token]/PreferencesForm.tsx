"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";

type Channel = "EMAIL" | "WHATSAPP" | "BOTH" | "OTHER";

interface Initial {
  preferredChannel: Channel;
  phone: string;
  whatsappNumber: string;
  whatsappConsent: boolean;
  emailConsent: boolean;
}

export function PreferencesForm({ token, initial }: { token: string; initial: Initial }) {
  const [state, setState] = useState<Initial>(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const res = await fetch(`/api/preferences/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(state)
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Save failed");
      }
      setSaved(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4">
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-slate-700">Preferred channel</legend>
        {(["EMAIL", "WHATSAPP", "BOTH", "OTHER"] as Channel[]).map((c) => (
          <label key={c} className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="channel"
              value={c}
              checked={state.preferredChannel === c}
              onChange={() => setState({ ...state, preferredChannel: c })}
            />
            {c === "EMAIL" && "Email only"}
            {c === "WHATSAPP" && "WhatsApp only"}
            {c === "BOTH" && "Email and WhatsApp"}
            {c === "OTHER" && "Something else"}
          </label>
        ))}
      </fieldset>

      <Field
        label="Phone number"
        type="tel"
        name="phone"
        value={state.phone}
        onChange={(e) => setState({ ...state, phone: e.target.value })}
      />
      <Field
        label="WhatsApp number (if different)"
        type="tel"
        name="whatsappNumber"
        value={state.whatsappNumber}
        onChange={(e) => setState({ ...state, whatsappNumber: e.target.value })}
      />

      <label className="flex items-start gap-3 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={state.whatsappConsent}
          onChange={(e) => setState({ ...state, whatsappConsent: e.target.checked })}
        />
        I&rsquo;d like to receive WhatsApp event notifications.
      </label>
      <label className="flex items-start gap-3 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={state.emailConsent}
          onChange={(e) => setState({ ...state, emailConsent: e.target.checked })}
        />
        I&rsquo;d like to receive email event notifications.
      </label>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}
      {saved && (
        <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          Preferences saved.
        </p>
      )}

      <Button type="submit" disabled={saving} className="w-full">
        {saving ? "Saving..." : "Save preferences"}
      </Button>
    </form>
  );
}
