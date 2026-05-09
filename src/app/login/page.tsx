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
    <main id="main" className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
      <div className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
        <h1 className="text-xl font-bold text-slate-900">Organiser sign-in</h1>
        <p className="mt-1 text-sm text-slate-600">
          Use your organiser account credentials.
        </p>

        {ssoMessage && (
          <p className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800" role="alert">
            {ssoMessage}
          </p>
        )}

        <LoginForm />

        {(ssoEnabled.google || ssoEnabled.azure) && (
          <>
            <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-wide text-slate-400">
              <span className="h-px flex-1 bg-slate-200" />
              or
              <span className="h-px flex-1 bg-slate-200" />
            </div>
            <SsoButtons google={ssoEnabled.google} azure={ssoEnabled.azure} />
          </>
        )}

        <details className="mt-6 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <summary className="cursor-pointer text-sm font-semibold text-slate-700">
            Forgot your password? Email me a sign-in link
          </summary>
          <MagicLinkForm />
        </details>

        <p className="mt-6 text-xs text-slate-500">
          MFA is required for Admin and Super Admin accounts in production. SSO is invite-only —
          your email must already exist as an organiser. The seeded development accounts are listed
          in the README.
        </p>
      </div>
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
