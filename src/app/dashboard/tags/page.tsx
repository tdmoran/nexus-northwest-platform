import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";

export default async function TagsPage() {
  await requireUser();

  // Postgres-friendly aggregation: unnest the tags array, group by value.
  const rows = await prisma.$queryRaw<Array<{ tag: string; count: bigint }>>`
    SELECT unnest("tags") AS tag, COUNT(*)::bigint AS count
    FROM "Member"
    WHERE "deletedAt" IS NULL AND "deletionRequestedAt" IS NULL
    GROUP BY tag
    ORDER BY count DESC, tag ASC
  `;

  const totalTagged = rows.reduce((s, r) => s + Number(r.count), 0);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Tags &amp; segments</h1>
        <p className="text-sm text-slate-600">
          Each tag becomes a member segment you can target from the announcement audience picker.
          Apply tags from a member&rsquo;s detail page or bulk-apply from the members list.
        </p>
      </header>

      <section className="overflow-hidden rounded-xl bg-white ring-1 ring-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">Tag</th>
              <th className="px-4 py-3 text-right font-semibold">Members</th>
              <th className="px-4 py-3 text-right font-semibold">Share</th>
              <th className="px-4 py-3 text-right font-semibold">Browse</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                  No tags yet. Apply tags to members and they&rsquo;ll appear here.
                </td>
              </tr>
            )}
            {rows.map((row) => {
              const count = Number(row.count);
              const pct = totalTagged === 0 ? 0 : Math.round((count / totalTagged) * 100);
              return (
                <tr key={row.tag}>
                  <td className="px-4 py-2">
                    <span className="rounded-md bg-brand-50 px-2 py-0.5 font-mono text-xs text-brand-700">
                      {row.tag}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right font-mono">{count}</td>
                  <td className="px-4 py-2 text-right font-mono text-slate-500">{pct}%</td>
                  <td className="px-4 py-2 text-right">
                    <Link
                      href={`/dashboard/members?q=${encodeURIComponent(row.tag)}`}
                      className="text-xs font-semibold text-brand-700 hover:underline"
                    >
                      View members &rarr;
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}
