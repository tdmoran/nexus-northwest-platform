// Server-rendered shell that hands the token to the client component, which
// completes the NextAuth credentials sign-in flow with the magic-link token.

import { MagicCallback } from "./MagicCallback";

export default function MagicLinkCallbackPage({ params }: { params: { token: string } }) {
  return (
    <main id="main" className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
      <div className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
        <h1 className="text-xl font-bold text-slate-900">Signing you in…</h1>
        <p className="mt-2 text-sm text-slate-600">
          One moment while we verify your link.
        </p>
        <MagicCallback token={decodeURIComponent(params.token)} />
      </div>
    </main>
  );
}
