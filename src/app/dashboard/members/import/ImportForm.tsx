"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { parseCsv, extractMemberRows } from "@/lib/csv-parse";

interface ImportResult {
  imported: number;
  skipped: number;
  failed: number;
  parseErrors: Array<{ rowIndex: number; reason: string }>;
  rowFailures: Array<{ rowIndex: number; email: string; reason: string }>;
}

export function ImportForm() {
  const router = useRouter();
  const [csv, setCsv] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const preview = parsePreview(csv);

  async function onSubmit() {
    if (!csv.trim()) return;
    if (preview.kind !== "ok" || preview.rows.length === 0) return;
    if (
      !confirm(
        `Import ${preview.rows.length} member row(s)? Existing emails will be updated, not duplicated.`
      )
    ) {
      return;
    }
    setSubmitting(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/members/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv })
      });
      const data = (await res.json()) as ImportResult & { error?: string };
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setResult(data);
      if (data.imported > 0) router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <label className="block">
        <span className="text-sm font-medium text-slate-700">CSV content</span>
        <textarea
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
          rows={12}
          placeholder={"name,email,utm_source,ref\nTom Moran,tom@example.com,linkedin,ABC123"}
          className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs shadow-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
        />
      </label>

      {preview.kind === "error" && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {preview.message}
        </p>
      )}

      {preview.kind === "ok" && preview.rows.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
          <p className="font-semibold text-slate-700">
            Preview: {preview.rows.length} valid row(s)
            {preview.errors.length > 0 && `, ${preview.errors.length} skipped`}
          </p>
          <ul className="mt-2 max-h-48 overflow-auto text-xs text-slate-600">
            {preview.rows.slice(0, 20).map((r) => (
              <li key={r.rowIndex} className="font-mono">
                {r.name} &lt;{r.email}&gt;
                {r.utmSource && ` · src:${r.utmSource}`}
                {r.referralCode && ` · ref:${r.referralCode}`}
              </li>
            ))}
            {preview.rows.length > 20 && (
              <li className="text-slate-500">…and {preview.rows.length - 20} more</li>
            )}
          </ul>
          {preview.errors.length > 0 && (
            <details className="mt-2 text-xs text-amber-700">
              <summary className="cursor-pointer">Skipped rows</summary>
              <ul className="mt-1">
                {preview.errors.map((e, i) => (
                  <li key={i}>
                    Row {e.rowIndex}: {e.reason}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      <Button
        onClick={onSubmit}
        disabled={submitting || preview.kind !== "ok" || preview.rows.length === 0}
      >
        {submitting ? "Importing…" : `Import ${preview.kind === "ok" ? preview.rows.length : 0} member(s)`}
      </Button>

      {error && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {result && (
        <div className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Imported {result.imported} new, updated {result.skipped} existing
          {result.failed > 0 && `, ${result.failed} failed`}.
          {result.rowFailures.length > 0 && (
            <details className="mt-2 text-amber-800">
              <summary className="cursor-pointer">Row failures</summary>
              <ul>
                {result.rowFailures.map((f, i) => (
                  <li key={i}>
                    Row {f.rowIndex} ({f.email}): {f.reason}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

type PreviewState =
  | { kind: "empty" }
  | { kind: "error"; message: string }
  | {
      kind: "ok";
      rows: Array<{ rowIndex: number; email: string; name: string; utmSource?: string; referralCode?: string }>;
      errors: Array<{ rowIndex: number; reason: string }>;
    };

function parsePreview(csv: string): PreviewState {
  if (!csv.trim()) return { kind: "empty" };
  try {
    const parsed = parseCsv(csv);
    const { rows, errors } = extractMemberRows(parsed);
    return { kind: "ok", rows, errors };
  } catch (err) {
    return { kind: "error", message: (err as Error).message };
  }
}
