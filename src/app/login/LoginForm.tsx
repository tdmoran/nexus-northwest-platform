"use client";

import { useState, type FormEvent } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [mfaRequired, setMfaRequired] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const res = await signIn("credentials", {
      email,
      password,
      mfaCode,
      redirect: false
    });
    setSubmitting(false);

    if (!res || res.error) {
      const code = res?.error ?? "";
      if (code === "MFA_REQUIRED") {
        setMfaRequired(true);
        setError("Enter the 6-digit code from your authenticator app.");
        return;
      }
      if (code === "MFA_INVALID") {
        setMfaRequired(true);
        setError("That code didn't match. Try the next one from your authenticator.");
        return;
      }
      setError("Invalid email or password.");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4">
      <Field
        label="Email"
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <Field
        label="Password"
        type="password"
        autoComplete="current-password"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      {mfaRequired && (
        <Field
          label="Authenticator code"
          type="text"
          inputMode="numeric"
          pattern="\d{6}"
          autoComplete="one-time-code"
          maxLength={6}
          required
          value={mfaCode}
          onChange={(e) => setMfaCode(e.target.value)}
          hint="6-digit code from your authenticator app (e.g. 1Password, Google Authenticator)."
        />
      )}
      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
      <Button type="submit" disabled={submitting} className="w-full">
        {submitting ? "Signing in..." : mfaRequired ? "Verify and sign in" : "Sign in"}
      </Button>
    </form>
  );
}
