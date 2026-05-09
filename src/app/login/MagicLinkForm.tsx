"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";

export function MagicLinkForm() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await fetch("/api/auth/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });
      setDone(true);
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <p
        role="status"
        aria-live="polite"
        className="mt-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700"
      >
        If that email is on the organiser list, a sign-in link is on its way. The link expires in
        15 minutes.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-4 space-y-3">
      <Field
        label="Email"
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        hint="We'll email you a one-time sign-in link."
      />
      <Button type="submit" disabled={submitting} className="w-full">
        {submitting ? "Sending…" : "Email me a sign-in link"}
      </Button>
    </form>
  );
}
