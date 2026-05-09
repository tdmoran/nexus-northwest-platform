import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/session";
import { canManageAnyUsers } from "@/lib/rbac-users";
import { SessionProvider } from "./SessionProvider";
import { LogoutButton } from "./LogoutButton";

const BASE_NAV = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/events", label: "Events" },
  { href: "/dashboard/members", label: "Members" },
  { href: "/dashboard/actions", label: "Actions" },
  { href: "/dashboard/audit", label: "Audit log" },
  { href: "/dashboard/settings", label: "Settings" }
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const NAV = canManageAnyUsers(user.role)
    ? [...BASE_NAV, { href: "/dashboard/users", label: "Users" }]
    : BASE_NAV;

  return (
    <SessionProvider>
      <div className="min-h-screen bg-slate-50">
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
            <Link href="/dashboard" className="text-base font-bold text-brand-700">
              Nexus Northwest &middot; Organiser
            </Link>
            <div className="flex items-center gap-4 text-sm text-slate-600">
              <span>
                {user.name} &middot; <span className="font-mono text-xs">{user.role}</span>
              </span>
              <LogoutButton />
            </div>
          </div>
          <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-2 pb-2 text-sm">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className="rounded-md px-3 py-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              >
                {n.label}
              </Link>
            ))}
          </nav>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
      </div>
    </SessionProvider>
  );
}
