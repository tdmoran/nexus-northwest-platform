import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";

export const metadata: Metadata = {
  title: "Community",
  description: "Public directory of opted-in Nexus Northwest members.",
  alternates: { canonical: "/community" }
};

export const dynamic = "force-dynamic";

export default async function CommunityPage() {
  const members = await prisma.member.findMany({
    where: {
      publicProfile: true,
      deletionRequestedAt: null,
      deletedAt: null
    },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      headline: true,
      bio: true,
      company: true,
      profilePictureUrl: true,
      linkedinUrl: true
    },
    take: 500
  });

  return (
    <main id="main" className="mx-auto max-w-4xl px-4 py-10 sm:py-16">
      <header className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-widest text-brand-600">
          {env.NEXT_PUBLIC_SITE_NAME}
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          The community
        </h1>
        <p className="mt-3 text-slate-600">
          Members who&rsquo;ve opted into a public profile. Want to be listed? Tick the box on your
          preferences page (in any email we send) and add a short headline.
        </p>
      </header>

      {members.length === 0 ? (
        <div className="rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
          <p className="text-slate-600">
            No public profiles yet. Be the first &mdash; opt in from your preferences page.
          </p>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {members.map((m) => (
            <li
              key={m.id}
              className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200"
            >
              <div className="flex items-start gap-4">
                {m.profilePictureUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={m.profilePictureUrl}
                    alt=""
                    className="h-16 w-16 flex-none rounded-full object-cover ring-1 ring-slate-200"
                  />
                ) : (
                  <div
                    aria-hidden="true"
                    className="flex h-16 w-16 flex-none items-center justify-center rounded-full bg-brand-50 text-lg font-semibold text-brand-700"
                  >
                    {initials(m.name)}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <h2 className="font-semibold text-slate-900">{m.name}</h2>
                  {m.headline && (
                    <p className="text-sm text-slate-600">{m.headline}</p>
                  )}
                  {m.company && !m.headline && (
                    <p className="text-sm text-slate-600">{m.company}</p>
                  )}
                  {m.bio && (
                    <p className="mt-2 line-clamp-3 text-sm text-slate-700">{m.bio}</p>
                  )}
                  {m.linkedinUrl && (
                    <a
                      href={m.linkedinUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-block text-xs font-semibold text-brand-700 hover:underline"
                    >
                      LinkedIn &rarr;
                    </a>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "·";
}
