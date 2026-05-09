import { redirect } from "next/navigation";
import { currentUser } from "@/lib/session";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  const user = await currentUser();
  if (user) redirect("/dashboard");

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
      <div className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
        <h1 className="text-xl font-bold text-slate-900">Organiser sign-in</h1>
        <p className="mt-1 text-sm text-slate-600">
          Use your organiser account credentials.
        </p>
        <LoginForm />
        <p className="mt-6 text-xs text-slate-500">
          MFA is required for Admin and Super Admin accounts in production. The seeded development
          accounts are listed in the README.
        </p>
      </div>
    </main>
  );
}
