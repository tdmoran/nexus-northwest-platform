import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { can } from "@/lib/rbac";
import { env } from "@/lib/env";

export default async function SettingsPage() {
  const user = await requireUser();
  const isAdmin = can(user.role, "users.manage.managers");

  const organisers = isAdmin
    ? await prisma.organiserUser.findMany({ orderBy: { role: "asc" } })
    : [];

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-slate-900">Settings</h1>

      <Section title="Integrations">
        <Row label="Email provider" value={env.EMAIL_PROVIDER} />
        <Row label="Email from" value={env.EMAIL_FROM} />
        <Row label="Zoho integration" value={env.ZOHO_ENABLED ? "Enabled" : "Stubbed"} />
        <Row label="Zoho module" value={env.ZOHO_MODULE} />
        <Row label="Site URL" value={env.NEXT_PUBLIC_SITE_URL} />
        <p className="mt-3 text-xs text-slate-500">
          Integration credentials are configured via environment variables. Only Super Admins should
          have access to those.
        </p>
      </Section>

      {isAdmin && (
        <Section title="Organiser users">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">Name</th>
                <th className="px-3 py-2 text-left font-semibold">Email</th>
                <th className="px-3 py-2 text-left font-semibold">Role</th>
                <th className="px-3 py-2 text-left font-semibold">Active</th>
                <th className="px-3 py-2 text-left font-semibold">Last login</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {organisers.map((o) => (
                <tr key={o.id}>
                  <td className="px-3 py-2 font-medium text-slate-900">{o.name}</td>
                  <td className="px-3 py-2 text-slate-600">{o.email}</td>
                  <td className="px-3 py-2 text-slate-600">{o.role}</td>
                  <td className="px-3 py-2">
                    {o.active ? (
                      <span className="rounded bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">
                        active
                      </span>
                    ) : (
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                        disabled
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-slate-600">
                    {o.lastLoginAt
                      ? o.lastLoginAt.toLocaleString("en-IE", {
                          dateStyle: "short",
                          timeStyle: "short"
                        })
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-slate-500">
            User CRUD UI is a Phase 2 enhancement; manage via Prisma seed or DB directly for now.
          </p>
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl bg-white p-6 ring-1 ring-slate-200">
      <h2 className="mb-4 text-sm font-semibold text-slate-900">{title}</h2>
      {children}
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 py-2 text-sm last:border-0">
      <span className="text-slate-600">{label}</span>
      <span className="font-mono text-xs text-slate-900">{value}</span>
    </div>
  );
}
