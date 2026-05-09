import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { MembersTable } from "./MembersTable";

export default async function MembersPage({
  searchParams
}: {
  searchParams: { q?: string };
}) {
  await requireUser();
  const q = (searchParams.q ?? "").trim();

  const members = await prisma.member.findMany({
    where: {
      deletionRequestedAt: null,
      deletedAt: null,
      ...(q
        ? {
            OR: [
              { email: { contains: q, mode: "insensitive" } },
              { name: { contains: q, mode: "insensitive" } },
              { company: { contains: q, mode: "insensitive" } },
              { tags: { has: q } }
            ]
          }
        : {})
    },
    orderBy: { createdAt: "desc" },
    take: 200
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Members</h1>
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/tags"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Tags
          </Link>
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
      <form className="flex items-center justify-end gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search name, email, company, or tag…"
          className="w-72 rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm"
        />
        <button
          type="submit"
          className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white"
        >
          Search
        </button>
      </form>

      <MembersTable
        emptyMessage={q ? `No members match "${q}".` : "No members yet."}
        members={members.map((m) => ({
          id: m.id,
          name: m.name,
          email: m.email,
          preferredChannel: m.preferredChannel,
          emailConsent: m.emailConsent,
          whatsappConsent: m.whatsappConsent,
          tags: m.tags,
          utmSource: m.utmSource,
          createdAt: m.createdAt.toISOString()
        }))}
      />
    </div>
  );
}
