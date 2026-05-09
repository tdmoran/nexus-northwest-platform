"use client";

import { useState } from "react";

export function GdprActions({
  token,
  deletionRequestedAt
}: {
  token: string;
  deletionRequestedAt: string | null;
}) {
  const [requesting, setRequesting] = useState(false);
  const [requested, setRequested] = useState(deletionRequestedAt);
  const [error, setError] = useState<string | null>(null);

  async function onRequestDelete() {
    if (
      !confirm(
        "Are you sure? Your data will be scheduled for deletion. You can change your mind in the next 30 days by emailing us; after that it's permanently scrubbed."
      )
    ) {
      return;
    }
    setRequesting(true);
    setError(null);
    try {
      const res = await fetch(`/api/preferences/${encodeURIComponent(token)}/delete`, {
        method: "POST"
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setRequested(data.scheduledFor);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRequesting(false);
    }
  }

  return (
    <section>
      <h2 className="text-sm font-semibold text-slate-900">Your data rights</h2>
      <p className="mt-1 text-xs text-slate-600">
        Under GDPR you can download a copy of every record we hold about you, or ask us to delete
        your account.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <a
          href={`/api/preferences/${encodeURIComponent(token)}/export`}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          Download my data (JSON)
        </a>

        {requested ? (
          <span className="rounded-md bg-amber-50 px-3 py-1.5 text-xs text-amber-800">
            Deletion scheduled for{" "}
            {new Date(
              new Date(requested).getTime() + 30 * 24 * 60 * 60 * 1000
            ).toLocaleDateString()}
            . Email us before then to cancel.
          </span>
        ) : (
          <button
            onClick={onRequestDelete}
            disabled={requesting}
            className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
          >
            {requesting ? "Requesting…" : "Delete my account"}
          </button>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      )}
    </section>
  );
}
