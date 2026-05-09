import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/session";
import { canManageAnyUsers } from "@/lib/rbac-users";
import { SessionProvider } from "./SessionProvider";
import { LogoutButton } from "./LogoutButton";

const BASE_NAV = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/events", label: "Events" },
  { href: "/dashboard/series", label: "Series" },
  { href: "/dashboard/members", label: "Members" },
  { href: "/dashboard/tags", label: "Tags" },
  { href: "/dashboard/actions", label: "Actions" },
  { href: "/dashboard/reports", label: "Reports" },
  { href: "/dashboard/qr", label: "QR + links" },
  { href: "/dashboard/audit", label: "Audit log" },
  { href: "/dashboard/compliance", label: "Compliance" },
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
      <div className="min-h-screen bg-soft-gradient">
        <header className="sticky top-0 z-20 border-b border-brand-100/70 bg-white/85 backdrop-blur supports-[backdrop-filter]:bg-white/70">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
            <Link
              href="/dashboard"
              className="flex items-center gap-2 text-brand-800 transition hover:text-brand-700"
              aria-label="Dashboard home"
            >
              <Image
                src="/logo.png"
                alt=""
                width={36}
                height={36}
                priority
                className="h-9 w-9 drop-shadow-[0_0_18px_rgba(46,163,154,0.35)]"
              />
              <div className="leading-tight">
                <p className="font-display text-sm font-bold tracking-wide">NEXUS NORTHWEST</p>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent-600">
                  Organiser
                </p>
              </div>
            </Link>
            <div className="flex items-center gap-3 text-sm">
              <div className="hidden text-right sm:block">
                <p className="font-semibold text-brand-800">{user.name}</p>
                <p className="text-[10px] font-mono uppercase tracking-wider text-brand-400">
                  {user.role}
                </p>
              </div>
              <LogoutButton />
            </div>
          </div>
          <nav
            aria-label="Dashboard sections"
            className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-2 pb-2 text-sm"
          >
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className="whitespace-nowrap rounded-full px-3.5 py-1.5 font-medium text-brand-600 transition hover:bg-brand-50 hover:text-brand-800"
              >
                {n.label}
              </Link>
            ))}
          </nav>
        </header>
        <main id="main" className="mx-auto max-w-6xl px-4 py-8 sm:py-10">
          {children}
        </main>
      </div>
    </SessionProvider>
  );
}
