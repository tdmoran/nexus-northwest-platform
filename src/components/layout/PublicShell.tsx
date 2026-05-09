import Image from "next/image";
import Link from "next/link";

export function PublicShell({
  children,
  showFooter = true
}: {
  children: React.ReactNode;
  showFooter?: boolean;
}) {
  return (
    <>
      <header className="sticky top-0 z-20 border-b border-brand-100/70 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/70">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <Link
            href="/"
            className="flex items-center gap-2 text-brand-800 transition hover:text-brand-700"
            aria-label="Nexus Northwest home"
          >
            <Image src="/logo.png" alt="" width={32} height={32} className="h-8 w-8" priority />
            <span className="font-display text-sm font-semibold tracking-wide">
              NEXUS NORTHWEST
            </span>
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            <NavLink href="/events">Events</NavLink>
            <NavLink href="/community">Community</NavLink>
            <Link
              href="/login"
              className="ml-1 rounded-full border border-brand-200 bg-white px-4 py-1.5 text-sm font-semibold text-brand-700 transition hover:border-brand-300 hover:bg-brand-50"
            >
              Sign in
            </Link>
          </nav>
        </div>
      </header>
      {children}
      {showFooter && <SiteFooter />}
    </>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="hidden rounded-full px-3 py-1.5 font-medium text-brand-600 transition hover:bg-brand-50 hover:text-brand-800 sm:inline-block"
    >
      {children}
    </Link>
  );
}

function SiteFooter() {
  return (
    <footer className="border-t border-brand-100 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-center gap-3 text-brand-700">
          <Image src="/logo.png" alt="" width={24} height={24} className="h-6 w-6" />
          <span className="font-display text-sm font-semibold">Nexus Northwest</span>
        </div>
        <nav className="flex flex-wrap gap-x-5 gap-y-2 text-brand-600">
          <Link href="/events" className="hover:text-brand-800">Events</Link>
          <Link href="/community" className="hover:text-brand-800">Community</Link>
          <Link href="/privacy" className="hover:text-brand-800">Privacy</Link>
          <a href="mailto:hello@nexusnorthwest.org" className="hover:text-brand-800">
            hello@nexusnorthwest.org
          </a>
        </nav>
        <p className="text-xs text-brand-400">© {new Date().getFullYear()} Nexus Northwest</p>
      </div>
    </footer>
  );
}

/**
 * A standard centred token-page card (welcome / RSVP / preferences / unsub /
 * survey landing). Wraps content in a soft gradient background, a glass card,
 * and a logo header.
 */
export function TokenPageShell({
  eyebrow,
  title,
  subtitle,
  children,
  size = "md"
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  const widthClass =
    size === "sm" ? "max-w-md" : size === "lg" ? "max-w-2xl" : "max-w-xl";
  return (
    <main
      id="main"
      className="relative isolate min-h-screen overflow-hidden bg-soft-gradient pb-16 pt-12"
    >
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 -z-10 h-64 bg-[radial-gradient(60%_60%_at_50%_0%,rgba(46,163,154,0.18),transparent_70%)]"
      />
      <div className={`mx-auto px-4 ${widthClass}`}>
        <Link
          href="/"
          className="mb-8 flex items-center gap-2 text-brand-700 transition hover:text-brand-800"
        >
          <Image src="/logo.png" alt="" width={32} height={32} className="h-8 w-8" priority />
          <span className="font-display text-sm font-semibold tracking-wide">
            NEXUS NORTHWEST
          </span>
        </Link>
        <div className="animate-fade-up rounded-3xl bg-white p-6 shadow-card ring-1 ring-brand-100/70 sm:p-10">
          {eyebrow && (
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent-600">
              {eyebrow}
            </p>
          )}
          <h1 className="mt-2 font-display text-2xl font-bold tracking-tight text-brand-800 sm:text-3xl">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-2 text-sm text-brand-600 sm:text-base">{subtitle}</p>
          )}
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </main>
  );
}
