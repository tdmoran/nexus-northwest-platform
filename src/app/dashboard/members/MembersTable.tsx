"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

interface MemberRow {
  id: string;
  name: string;
  email: string;
  preferredChannel: string;
  emailConsent: boolean;
  whatsappConsent: boolean;
  tags: string[];
  utmSource: string | null;
  createdAt: string;
}

export function MembersTable({
  members,
  emptyMessage
}: {
  members: MemberRow[];
  emptyMessage: string;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [tagInput, setTagInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const allSelected = members.length > 0 && selected.size === members.length;
  const tags = useMemo(
    () =>
      tagInput
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    [tagInput]
  );

  function toggleAll() {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(members.map((m) => m.id)));
  }

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  async function applyBulk(action: "add" | "remove") {
    if (selected.size === 0 || tags.length === 0) return;
    setBusy(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/members/bulk-tag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberIds: [...selected],
          [action]: tags
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setFeedback(
        `${action === "add" ? "Added" : "Removed"} ${tags.join(", ")} on ${data.updated} member(s).`
      );
      setSelected(new Set());
      setTagInput("");
      router.refresh();
    } catch (err) {
      setFeedback(`Failed: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {selected.size > 0 && (
        <div className="sticky top-2 z-10 flex flex-wrap items-center gap-2 rounded-xl bg-brand-50 p-3 ring-1 ring-brand-200">
          <span className="text-sm font-semibold text-brand-800">
            {selected.size} selected
          </span>
          <input
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            placeholder="Tag(s), comma-separated"
            className="rounded-md border border-brand-200 px-3 py-1.5 text-sm"
          />
          <button
            type="button"
            disabled={busy || tags.length === 0}
            onClick={() => applyBulk("add")}
            className="rounded-md bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            Add tag
          </button>
          <button
            type="button"
            disabled={busy || tags.length === 0}
            onClick={() => applyBulk("remove")}
            className="rounded-md border border-brand-300 bg-white px-3 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-50 disabled:opacity-60"
          >
            Remove tag
          </button>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="ml-auto rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Clear selection
          </button>
          {feedback && (
            <span role="status" aria-live="polite" className="basis-full text-xs text-brand-700">
              {feedback}
            </span>
          )}
        </div>
      )}

      <div className="overflow-hidden rounded-xl bg-white ring-1 ring-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="w-10 px-2 py-3">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  aria-label="Select all"
                />
              </th>
              <Th>Name</Th>
              <Th>Email</Th>
              <Th>Tags</Th>
              <Th>Channel</Th>
              <Th>Consent</Th>
              <Th>Source</Th>
              <Th>Joined</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {members.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-slate-500">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              members.map((m) => (
                <tr key={m.id} className="hover:bg-slate-50">
                  <td className="px-2 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(m.id)}
                      onChange={() => toggle(m.id)}
                      aria-label={`Select ${m.name}`}
                    />
                  </td>
                  <td className="px-4 py-3 font-medium">
                    <Link
                      href={`/dashboard/members/${m.id}`}
                      className="text-brand-700 hover:underline"
                    >
                      {m.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{m.email}</td>
                  <td className="px-4 py-3">
                    {m.tags.length === 0 ? (
                      <span className="text-xs text-slate-400">—</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {m.tags.map((t) => (
                          <span
                            key={t}
                            className="rounded bg-brand-50 px-1.5 py-0.5 font-mono text-[11px] text-brand-700"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{m.preferredChannel}</td>
                  <td className="px-4 py-3 text-xs">
                    <ConsentBadge ok={m.emailConsent} label="email" />{" "}
                    <ConsentBadge ok={m.whatsappConsent} label="whatsapp" />
                  </td>
                  <td className="px-4 py-3 text-slate-600">{m.utmSource ?? "direct"}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {new Date(m.createdAt).toLocaleDateString("en-IE")}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-3 text-left font-semibold">{children}</th>;
}

function ConsentBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 ${
        ok ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
      }`}
    >
      {label}
    </span>
  );
}
