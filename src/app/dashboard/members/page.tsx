import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";

export default async function MembersPage({
  searchParams
}: {
  searchParams: { q?: string };
}) {
  await requireUser();
  const q = (searchParams.q ?? "").trim();

  const members = await prisma.member.findMany({
    where: q
      ? {
          OR: [
            { email: { contains: q, mode: "insensitive" } },
            { name: { contains: q, mode: "insensitive" } },
            { company: { contains: q, mode: "insensitive" } },
            { tags: { has: q } }
          ]
        }
      : undefined,
    orderBy: { createdAt: "desc" },
    take: 200
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Members</h1>
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/members/import"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Import CSV
          </Link>
          <a
            href="/api/exports/members"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Export CSV
          </a>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <span />
        <form className="flex items-center gap-2">
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search name, email, company..."
            className="w-72 rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm"
          />
          <button
            type="submit"
            className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white"
          >
            Search
          </button>
        </form>
      </div>

      <div className="overflow-hidden rounded-xl bg-white ring-1 ring-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <Th>Name</Th>
              <Th>Email</Th>
              <Th>Channel</Th>
              <Th>Consent</Th>
              <Th>Source</Th>
              <Th>Joined</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {members.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                  {q ? `No members match "${q}".` : "No members yet."}
                </td>
              </tr>
            ) : (
              members.map((m) => (
                <tr key={m.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium">
                    <Link
                      href={`/dashboard/members/${m.id}`}
                      className="text-brand-700 hover:underline"
                    >
                      {m.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{m.email}</td>
                  <td className="px-4 py-3 text-slate-600">{m.preferredChannel}</td>
                  <td className="px-4 py-3 text-xs">
                    <ConsentBadge ok={m.emailConsent} label="email" />{" "}
                    <ConsentBadge ok={m.whatsappConsent} label="whatsapp" />
                  </td>
                  <td className="px-4 py-3 text-slate-600">{m.utmSource ?? "direct"}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {m.createdAt.toLocaleDateString("en-IE")}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
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
