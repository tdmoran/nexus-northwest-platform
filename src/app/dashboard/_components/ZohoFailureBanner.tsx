"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ZohoFailureBanner({ count, canRetry }: { count: number; canRetry: boolean }) {
  const router = useRouter();
  const [retrying, setRetrying] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  if (count === 0) return null;

  async function onRetry() {
    setRetrying(true);
    setResult(null);
    try {
      const res = await fetch("/api/zoho/retry", { method: "POST" });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { retried: number; succeeded: number };
      setResult(`Retried ${data.retried}; ${data.succeeded} succeeded.`);
      router.refresh();
    } catch (err) {
      setResult(`Retry failed: ${(err as Error).message}`);
    } finally {
      setRetrying(false);
    }
  }

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">
            {count} member{count === 1 ? "" : "s"} did not sync to Zoho.
          </p>
          <p className="text-xs">
            New sign-ups are saved locally; their Zoho records will be created when retry succeeds.
          </p>
        </div>
        {canRetry && (
          <button
            onClick={onRetry}
            disabled={retrying}
            className="rounded-md bg-amber-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-800 disabled:opacity-60"
          >
            {retrying ? "Retrying..." : "Retry now"}
          </button>
        )}
      </div>
      {result && <p className="mt-2 text-xs">{result}</p>}
    </div>
  );
}
