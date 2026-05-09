import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/session";
import { ssoEnabled } from "@/lib/auth";
import { LoginForm } from "./LoginForm";
import { SsoButtons } from "./SsoButtons";
import { MagicLinkForm } from "./MagicLinkForm";

export default async function LoginPage({
  searchParams
}: {
  searchParams: { error?: string };
}) {
  const user = await currentUser();
  if (user) redirect("/dashboard");

  const ssoMessage = mapSsoError(searchParams.error);

  return (
    <main
      id="main"
      className="relative isolate grid min-h-screen overflow-hidden lg:grid-cols-2"
    >
      {/* Left brand panel — desktop only */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-hero-gradient p-10 text-white lg:flex">
        <div
          className="glow-blob a"
          aria-hidden="true"
          style={{ top: "10%", left: "20%", width: "30vw", height: "30vw", background: "#2ea39a" }}
        />
        <div
          className="glow-blob b"
          aria-hidden="true"
          style={{ bottom: "10%", right: "10%", width: "25vw", height: "25vw", background: "#3a5a8a" }}
        />
        <Link href="/" className="relative flex items-center gap-3">
          <Image
            src="/logo.png"
            alt=""
            width={40}
            height={40}
            priority
            className="h-10 w-10 drop-shadow-[0_0_24px_rgba(46,163,154,0.5)]"
          />
          <span className="font-display text-sm font-semibold tracking-[0.25em]">
            NEXUS NORTHWEST
          </span>
        </Link>
        <div className="relative">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent-300">
            Organiser sign-in
          </p>
          <h1 className="mt-3 font-display text-3xl font-bold leading-tight">
            The control room behind every meet-up.
          </h1>
          <p className="mt-3 max-w-sm text-white/70">
            Manage events, send announcements, see who&rsquo;s coming. Audit-logged, GDPR-compliant,
            EU-hosted.
          </p>
        </div>
        <p className="relative text-xs text-white/50">
          © {new Date().getFullYear()} Nexus Northwest · Sligo, Ireland
        </p>
      </aside>

      {/* Right form panel */}
      <section className="flex flex-col items-stretch justify-center bg-white p-6 sm:p-12 lg:p-16">
        <div className="mx-auto w-full max-w-sm">
          {/* Mobile-only logo header */}
          <Link
            href="/"
            className="mb-8 flex items-center justify-center gap-2 text-brand-800 lg:hidden"
          >
            <Image src="/logo.png" alt="" width={32} height={32} className="h-8 w-8" priority />
            <span className="font-display text-sm font-semibold tracking-wide">
              NEXUS NORTHWEST
            </span>
          </Link>

          <h2 className="font-display text-2xl font-bold tracking-tight text-brand-800">
            Welcome back
          </h2>
          <p className="mt-1 text-sm text-brand-600">
            Use your organiser account credentials.
          </p>

          {ssoMessage && (
            <p
              role="alert"
              className="mt-4 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800 ring-1 ring-amber-100"
            >
              {ssoMessage}
            </p>
          )}

          <LoginForm />

          {(ssoEnabled.google || ssoEnabled.azure) && (
            <>
              <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-wide text-brand-300">
                <span className="h-px flex-1 bg-brand-100" />
                or
                <span className="h-px flex-1 bg-brand-100" />
              </div>
              <SsoButtons google={ssoEnabled.google} azure={ssoEnabled.azure} />
            </>
          )}

          <details className="group mt-6 rounded-2xl border border-brand-100 bg-brand-50/50 px-4 py-3 transition open:bg-brand-50">
            <summary className="cursor-pointer list-none text-sm font-semibold text-brand-700">
              Forgot your password? Email me a sign-in link
            </summary>
            <MagicLinkForm />
          </details>

          <p className="mt-8 text-xs text-brand-400">
            MFA is required for Admin and Super Admin accounts in production. SSO is invite-only —
            your email must already exist as an organiser.
          </p>
        </div>
      </section>
    </main>
  );
}

function mapSsoError(code: string | undefined): string | null {
  switch (code) {
    case "sso_not_invited":
      return "That email isn't on the organiser list. Ask an Admin to invite you first.";
    case "sso_disabled":
      return "Your organiser account is disabled. Ask an Admin to re-enable it.";
    case "sso_no_email":
      return "Your provider didn't share an email address. Try the email + password flow instead.";
    default:
      return null;
  }
}
