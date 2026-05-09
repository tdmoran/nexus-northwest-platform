import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { OrganiserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { canManageAnyUsers, canManageRole, MANAGEABLE_ROLES_FOR } from "@/lib/rbac-users";
import { audit } from "@/lib/audit";

async function inviteUser(formData: FormData) {
  "use server";
  const actor = await requireUser();
  if (!canManageAnyUsers(actor.role)) redirect("/dashboard?error=forbidden");

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const name = String(formData.get("name") ?? "").trim();
  const role = String(formData.get("role") ?? "") as OrganiserRole;
  const tempPassword = String(formData.get("tempPassword") ?? "").trim();

  if (!email || !name || !tempPassword) redirect("/dashboard/users?error=missing_fields");
  if (!canManageRole(actor.role, role)) redirect("/dashboard/users?error=forbidden_role");
  if (tempPassword.length < 12) redirect("/dashboard/users?error=password_too_short");

  const passwordHash = await bcrypt.hash(tempPassword, 12);
  const created = await prisma.organiserUser.upsert({
    where: { email },
    update: { name, role, active: true },
    create: { email, name, role, passwordHash, active: true }
  });

  await audit({
    action: "organiser.user.invite",
    actorId: actor.id,
    meta: { targetUserId: created.id, email, role }
  });

  redirect("/dashboard/users?ok=invited");
}

async function changeRole(formData: FormData) {
  "use server";
  const actor = await requireUser();
  const targetId = String(formData.get("userId") ?? "");
  const newRole = String(formData.get("role") ?? "") as OrganiserRole;
  if (!targetId) redirect("/dashboard/users?error=missing_user");

  const target = await prisma.organiserUser.findUnique({ where: { id: targetId } });
  if (!target) redirect("/dashboard/users?error=user_not_found");
  if (!canManageRole(actor.role, target.role) || !canManageRole(actor.role, newRole)) {
    redirect("/dashboard/users?error=forbidden_role");
  }
  if (target.id === actor.id && newRole !== target.role) {
    redirect("/dashboard/users?error=cannot_change_own_role");
  }

  await prisma.organiserUser.update({ where: { id: targetId }, data: { role: newRole } });
  await audit({
    action: "organiser.user.role_changed",
    actorId: actor.id,
    meta: { targetUserId: targetId, from: target.role, to: newRole }
  });
  redirect("/dashboard/users?ok=role_changed");
}

async function setActive(formData: FormData) {
  "use server";
  const actor = await requireUser();
  const targetId = String(formData.get("userId") ?? "");
  const active = formData.get("active") === "true";
  if (!targetId) redirect("/dashboard/users?error=missing_user");

  const target = await prisma.organiserUser.findUnique({ where: { id: targetId } });
  if (!target) redirect("/dashboard/users?error=user_not_found");
  if (!canManageRole(actor.role, target.role)) redirect("/dashboard/users?error=forbidden_role");
  if (target.id === actor.id) redirect("/dashboard/users?error=cannot_disable_self");

  await prisma.organiserUser.update({ where: { id: targetId }, data: { active } });
  await audit({
    action: active ? "organiser.user.enabled" : "organiser.user.disabled",
    actorId: actor.id,
    meta: { targetUserId: targetId }
  });
  redirect("/dashboard/users?ok=updated");
}

async function resetPassword(formData: FormData) {
  "use server";
  const actor = await requireUser();
  const targetId = String(formData.get("userId") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "").trim();

  const target = await prisma.organiserUser.findUnique({ where: { id: targetId } });
  if (!target) redirect("/dashboard/users?error=user_not_found");
  if (!canManageRole(actor.role, target.role)) redirect("/dashboard/users?error=forbidden_role");
  if (newPassword.length < 12) redirect("/dashboard/users?error=password_too_short");

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.organiserUser.update({ where: { id: targetId }, data: { passwordHash } });
  await audit({
    action: "organiser.user.password_reset",
    actorId: actor.id,
    meta: { targetUserId: targetId }
  });
  redirect("/dashboard/users?ok=password_reset");
}

export default async function UsersPage({
  searchParams
}: {
  searchParams: { ok?: string; error?: string };
}) {
  const actor = await requireUser();
  if (!canManageAnyUsers(actor.role)) redirect("/dashboard?error=forbidden");

  const manageableRoles = MANAGEABLE_ROLES_FOR[actor.role];
  const users = await prisma.organiserUser.findMany({
    where: { role: { in: manageableRoles } },
    orderBy: [{ active: "desc" }, { role: "asc" }, { name: "asc" }]
  });

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-slate-900">Organiser users</h1>

      {searchParams.ok && (
        <p className="rounded-lg bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
          {labelOk(searchParams.ok)}
        </p>
      )}
      {searchParams.error && (
        <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">
          {labelError(searchParams.error)}
        </p>
      )}

      <section className="rounded-xl bg-white p-6 ring-1 ring-slate-200">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Invite a new user</h2>
        <form action={inviteUser} className="grid gap-3 sm:grid-cols-5">
          <input
            name="name"
            placeholder="Name"
            required
            className="rounded-md border border-slate-300 px-3 py-2 text-sm sm:col-span-1"
          />
          <input
            name="email"
            type="email"
            placeholder="Email"
            required
            className="rounded-md border border-slate-300 px-3 py-2 text-sm sm:col-span-1"
          />
          <select
            name="role"
            required
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            {manageableRoles.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <input
            name="tempPassword"
            type="text"
            placeholder="Temp password (12+ chars)"
            required
            minLength={12}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="rounded-md bg-brand-600 px-3 py-2 text-sm font-semibold text-white"
          >
            Invite
          </button>
        </form>
        <p className="mt-2 text-xs text-slate-500">
          Share the temp password out-of-band and ask them to change it after first login.
        </p>
      </section>

      <section className="overflow-hidden rounded-xl bg-white ring-1 ring-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">Name</th>
              <th className="px-4 py-3 text-left font-semibold">Email</th>
              <th className="px-4 py-3 text-left font-semibold">Role</th>
              <th className="px-4 py-3 text-left font-semibold">Status</th>
              <th className="px-4 py-3 text-left font-semibold">Last login</th>
              <th className="px-4 py-3 text-left font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                  No users yet.
                </td>
              </tr>
            )}
            {users.map((u) => (
              <tr key={u.id}>
                <td className="px-4 py-2 font-medium text-slate-900">{u.name}</td>
                <td className="px-4 py-2 text-slate-600">{u.email}</td>
                <td className="px-4 py-2">
                  <form action={changeRole} className="flex items-center gap-2">
                    <input type="hidden" name="userId" value={u.id} />
                    <select
                      name="role"
                      defaultValue={u.role}
                      className="rounded-md border border-slate-300 px-2 py-1 text-xs"
                    >
                      {manageableRoles.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                    <button
                      type="submit"
                      className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      Save
                    </button>
                  </form>
                </td>
                <td className="px-4 py-2">
                  {u.active ? (
                    <span className="rounded bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">
                      active
                    </span>
                  ) : (
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                      disabled
                    </span>
                  )}
                </td>
                <td className="px-4 py-2 text-slate-600">
                  {u.lastLoginAt
                    ? u.lastLoginAt.toLocaleString("en-IE", {
                        dateStyle: "short",
                        timeStyle: "short"
                      })
                    : "—"}
                </td>
                <td className="px-4 py-2">
                  <div className="flex flex-wrap gap-2">
                    <form action={setActive}>
                      <input type="hidden" name="userId" value={u.id} />
                      <input type="hidden" name="active" value={u.active ? "false" : "true"} />
                      <button
                        type="submit"
                        className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                      >
                        {u.active ? "Disable" : "Enable"}
                      </button>
                    </form>
                    <form action={resetPassword} className="flex items-center gap-1">
                      <input type="hidden" name="userId" value={u.id} />
                      <input
                        name="newPassword"
                        type="text"
                        placeholder="New password"
                        minLength={12}
                        className="w-36 rounded-md border border-slate-300 px-2 py-1 text-xs"
                      />
                      <button
                        type="submit"
                        className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                      >
                        Reset
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function labelOk(code: string): string {
  switch (code) {
    case "invited":
      return "User invited.";
    case "role_changed":
      return "Role updated.";
    case "updated":
      return "User updated.";
    case "password_reset":
      return "Password reset.";
    default:
      return "Done.";
  }
}

function labelError(code: string): string {
  switch (code) {
    case "missing_fields":
      return "Please fill in all required fields.";
    case "forbidden_role":
      return "You can't manage that role.";
    case "password_too_short":
      return "Password must be at least 12 characters.";
    case "user_not_found":
      return "User not found.";
    case "cannot_change_own_role":
      return "You can't change your own role.";
    case "cannot_disable_self":
      return "You can't disable yourself.";
    default:
      return "Something went wrong.";
  }
}
