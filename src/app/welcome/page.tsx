import Link from "next/link";
import { TokenPageShell } from "@/components/layout/PublicShell";

export default function WelcomePage() {
  return (
    <TokenPageShell
      eyebrow="You're in"
      title="Welcome to Nexus Northwest."
      subtitle="We've sent you a welcome email with the next steps and a link to manage your communication preferences."
      size="md"
    >
      <div className="flex justify-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-accent-50 text-accent-600 ring-1 ring-accent-100">
          <svg
            width="36"
            height="36"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
      </div>
      <p className="mt-6 text-center text-sm text-brand-600">
        Looking forward to meeting you at the next event.
      </p>
      <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        <Link
          href="/events"
          className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-b from-accent-400 to-accent-600 px-5 py-2.5 text-sm font-semibold text-white shadow-glow transition hover:from-accent-300 hover:to-accent-500 sm:w-auto"
        >
          See upcoming events
        </Link>
        <Link
          href="/"
          className="text-sm font-semibold text-brand-600 hover:text-brand-800"
        >
          ← Back to home
        </Link>
      </div>
    </TokenPageShell>
  );
}
