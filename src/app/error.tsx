"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface the error in the browser console for development; in production,
    // a real APM hook would replace this.
    // eslint-disable-next-line no-console
    console.error("App error", { digest: error.digest, message: error.message });
  }, [error]);

  return (
    <main className="mx-auto max-w-xl px-4 py-16">
      <div className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
        <h1 className="text-2xl font-bold text-slate-900">Something went wrong</h1>
        <p className="mt-3 text-slate-600">
          We hit an unexpected error. Please try again. If the problem persists, contact the
          organisers.
        </p>
        {error.digest && (
          <p className="mt-3 font-mono text-xs text-slate-500">
            Reference: {error.digest}
          </p>
        )}
        <button
          onClick={reset}
          className="mt-6 inline-block rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
