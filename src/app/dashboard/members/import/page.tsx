import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { can } from "@/lib/rbac";
import { ImportForm } from "./ImportForm";

export default async function ImportMembersPage() {
  const user = await requireUser();
  if (!can(user.role, "members.edit.full")) redirect("/dashboard?error=forbidden");

  return (
    <div className="max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Import members</h1>
        <p className="text-sm text-slate-600">
          Paste CSV with at minimum <code>name,email</code> columns. Optional columns:{" "}
          <code>utm_source</code>, <code>ref</code>. Existing members (matched by email) are
          updated, not duplicated.
        </p>
      </header>

      <ImportForm />
    </div>
  );
}
