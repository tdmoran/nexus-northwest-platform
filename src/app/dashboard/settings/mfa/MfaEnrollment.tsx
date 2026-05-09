"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";

export function MfaEnrollment({ enrolled, accountEmail }: { enrolled: boolean; accountEmail: string }) {
  const router = useRouter();
  const [enrolling, setEnrolling] = useState(false);
  const [otpauthUrl, setOtpauthUrl] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function startEnrollment() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/mfa/enroll", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to start enrollment");
      setOtpauthUrl(data.otpauthUrl);
      setSecret(data.secret);
      setEnrolling(true);
    } catch (err) {
      setMessage({ kind: "err", text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/mfa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Verification failed");
      setMessage({ kind: "ok", text: "MFA is now enabled. You'll be asked for a code on next sign-in." });
      setEnrolling(false);
      setOtpauthUrl(null);
      setSecret(null);
      setCode("");
      router.refresh();
    } catch (err) {
      setMessage({ kind: "err", text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    if (!confirm("Disable MFA? You'll only need your password to sign in until you re-enroll.")) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/mfa/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Disable failed");
      setMessage({ kind: "ok", text: "MFA disabled." });
      setCode("");
      router.refresh();
    } catch (err) {
      setMessage({ kind: "err", text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  if (enrolled) {
    return (
      <div className="rounded-xl bg-white p-6 ring-1 ring-slate-200">
        <p className="text-sm text-slate-700">
          MFA is currently <strong>enabled</strong> for <code>{accountEmail}</code>. To disable, enter
          a current authenticator code below.
        </p>
        <div className="mt-4 max-w-xs space-y-3">
          <Field
            label="Current authenticator code"
            type="text"
            inputMode="numeric"
            pattern="\d{6}"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <Button variant="danger" disabled={busy} onClick={disable}>
            {busy ? "Disabling..." : "Disable MFA"}
          </Button>
        </div>
        {message && (
          <p
            className={`mt-3 rounded-md px-3 py-2 text-sm ${
              message.kind === "ok"
                ? "bg-emerald-50 text-emerald-700"
                : "bg-red-50 text-red-700"
            }`}
          >
            {message.text}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-white p-6 ring-1 ring-slate-200">
      {!enrolling ? (
        <>
          <p className="text-sm text-slate-700">
            We&rsquo;ll generate a TOTP secret you can add to any standards-compliant authenticator
            app (1Password, Google Authenticator, Authy, etc.).
          </p>
          <Button onClick={startEnrollment} disabled={busy} className="mt-4">
            {busy ? "Starting..." : "Set up authenticator"}
          </Button>
        </>
      ) : (
        <div className="space-y-4">
          <ol className="ml-5 list-decimal text-sm text-slate-700 space-y-2">
            <li>
              Scan the QR code below with your authenticator app, or enter the secret manually.
            </li>
            <li>Enter the 6-digit code your app shows to confirm.</li>
          </ol>

          {otpauthUrl && (
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <img
                src={`/api/qr?url=${encodeURIComponent(otpauthUrl)}&format=svg`}
                alt="MFA enrollment QR"
                className="mx-auto h-auto w-full max-w-xs"
              />
            </div>
          )}

          {secret && (
            <p className="text-xs text-slate-600">
              Secret (manual entry): <code className="font-mono">{secret}</code>
            </p>
          )}

          <div className="max-w-xs space-y-3">
            <Field
              label="6-digit code from your authenticator"
              type="text"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            <Button onClick={verifyCode} disabled={busy || code.length !== 6}>
              {busy ? "Verifying..." : "Confirm and enable"}
            </Button>
          </div>
        </div>
      )}

      {message && (
        <p
          className={`mt-3 rounded-md px-3 py-2 text-sm ${
            message.kind === "ok"
              ? "bg-emerald-50 text-emerald-700"
              : "bg-red-50 text-red-700"
          }`}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
