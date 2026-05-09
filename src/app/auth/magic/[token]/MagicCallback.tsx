"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export function MagicCallback({ token }: { token: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await signIn("credentials", { magicToken: token, redirect: false });
      if (cancelled) return;
      if (!res || res.error) {
        setError("This link is invalid, expired, or already used. Please request a new one.");
        return;
      }
      router.push("/dashboard");
      router.refresh();
    })();
    return () => {
      cancelled = true;
    };
  }, [token, router]);

  if (!error) return null;

  return (
    <div className="mt-4">
      <p
        role="alert"
        aria-live="polite"
        className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700"
      >
        {error}
      </p>
      <a
        href="/login"
        className="mt-4 inline-block rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
      >
        Back to sign-in
      </a>
    </div>
  );
}
