"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import type { SurveyQuestion } from "@/server/surveys";

export function SurveyForm({
  token,
  questions
}: {
  token: string;
  questions: SurveyQuestion[];
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set(id: string, v: string) {
    setAnswers((prev) => ({ ...prev, [id]: v }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/survey/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers })
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      setDone(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <p
        role="status"
        aria-live="polite"
        className="mt-6 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700"
      >
        Got it &mdash; thank you for the feedback.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-5">
      {questions.map((q) => (
        <fieldset key={q.id} className="space-y-2">
          <legend className="text-sm font-medium text-slate-800">{q.prompt}</legend>
          {q.kind === "rating" && (
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <label
                  key={n}
                  className={`flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border text-sm font-semibold transition ${
                    answers[q.id] === String(n)
                      ? "border-brand-500 bg-brand-50 text-brand-700"
                      : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <input
                    type="radio"
                    name={q.id}
                    value={n}
                    className="sr-only"
                    checked={answers[q.id] === String(n)}
                    onChange={(e) => set(q.id, e.target.value)}
                    required
                  />
                  {n}
                </label>
              ))}
            </div>
          )}
          {q.kind === "text" && (
            <textarea
              name={q.id}
              rows={3}
              value={answers[q.id] ?? ""}
              onChange={(e) => set(q.id, e.target.value)}
              className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
            />
          )}
          {q.kind === "choice" && q.choices && (
            <div className="space-y-1">
              {q.choices.map((c) => (
                <label key={c} className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="radio"
                    name={q.id}
                    value={c}
                    checked={answers[q.id] === c}
                    onChange={(e) => set(q.id, e.target.value)}
                    required
                  />
                  {c}
                </label>
              ))}
            </div>
          )}
        </fieldset>
      ))}

      {error && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <Button type="submit" disabled={submitting} className="w-full">
        {submitting ? "Submitting…" : "Submit feedback"}
      </Button>
    </form>
  );
}
