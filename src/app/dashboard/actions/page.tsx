import { redirect } from "next/navigation";
import { ActionStatus, ActionType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { can } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { actionSchema } from "@/lib/validation";

const STATUS_VALUES: ActionStatus[] = [
  ActionStatus.NEW,
  ActionStatus.CONTACTED,
  ActionStatus.CONFIRMED,
  ActionStatus.SCHEDULED,
  ActionStatus.COMPLETED,
  ActionStatus.CANCELLED
];

const TYPE_VALUES: ActionType[] = [
  ActionType.TASK,
  ActionType.SPEAKER_PROSPECT,
  ActionType.CONTRIBUTOR_PROSPECT,
  ActionType.THEME
];

async function createAction(formData: FormData) {
  "use server";
  const user = await requireUser();
  if (!can(user.role, "actions.edit")) redirect("/dashboard/actions?error=forbidden");

  const raw = {
    type: (formData.get("type") as string) || "TASK",
    title: formData.get("title"),
    notes: (formData.get("notes") as string) || null,
    status: "NEW",
    dueAt: formData.get("dueAt") || null,
    ownerId: (formData.get("ownerId") as string) || user.id
  };
  const parsed = actionSchema.safeParse(raw);
  if (!parsed.success) {
    redirect("/dashboard/actions?error=validation");
  } else {
    const created = await prisma.actionItem.create({
      data: {
        type: parsed.data.type,
        title: parsed.data.title,
        notes: parsed.data.notes,
        status: parsed.data.status,
        dueAt: parsed.data.dueAt ?? null,
        ownerId: parsed.data.ownerId ?? user.id
      }
    });
    await audit({
      action: "action.created",
      actorId: user.id,
      meta: { actionId: created.id, type: created.type }
    });
  }
  redirect("/dashboard/actions");
}

async function updateAction(formData: FormData) {
  "use server";
  const user = await requireUser();
  if (!can(user.role, "actions.edit")) redirect("/dashboard/actions?error=forbidden");

  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "") as ActionStatus;
  const ownerId = (formData.get("ownerId") as string) || null;

  if (!id) redirect("/dashboard/actions?error=missing_id");
  if (!STATUS_VALUES.includes(status)) redirect("/dashboard/actions?error=invalid_status");

  const before = await prisma.actionItem.findUnique({ where: { id } });
  if (!before) redirect("/dashboard/actions?error=not_found");

  await prisma.actionItem.update({
    where: { id },
    data: { status, ownerId: ownerId || null }
  });

  await audit({
    action: "action.updated",
    actorId: user.id,
    meta: {
      actionId: id,
      from: { status: before.status, ownerId: before.ownerId },
      to: { status, ownerId }
    }
  });

  redirect("/dashboard/actions");
}

export default async function ActionsPage() {
  const user = await requireUser();
  const canEdit = can(user.role, "actions.edit");

  const [actions, organisers] = await Promise.all([
    prisma.actionItem.findMany({
      orderBy: [{ status: "asc" }, { dueAt: "asc" }],
      include: { owner: true }
    }),
    prisma.organiserUser.findMany({ where: { active: true }, orderBy: { name: "asc" } })
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Actions</h1>

      {canEdit && (
        <form
          action={createAction}
          className="grid gap-3 rounded-xl bg-white p-4 ring-1 ring-slate-200 sm:grid-cols-6"
        >
          <select name="type" className="rounded-md border border-slate-300 px-2 py-2 text-sm">
            {TYPE_VALUES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <input
            name="title"
            placeholder="Title"
            required
            className="rounded-md border border-slate-300 px-2 py-2 text-sm sm:col-span-2"
          />
          <input
            name="dueAt"
            type="date"
            className="rounded-md border border-slate-300 px-2 py-2 text-sm"
          />
          <select name="ownerId" className="rounded-md border border-slate-300 px-2 py-2 text-sm">
            <option value={user.id}>Me ({user.name})</option>
            {organisers
              .filter((o) => o.id !== user.id)
              .map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
          </select>
          <button
            type="submit"
            className="rounded-md bg-brand-600 px-3 py-2 text-sm font-semibold text-white"
          >
            Add
          </button>
          <textarea
            name="notes"
            placeholder="Notes (optional)"
            rows={2}
            className="rounded-md border border-slate-300 px-2 py-2 text-sm sm:col-span-6"
          />
        </form>
      )}

      <div className="overflow-hidden rounded-xl bg-white ring-1 ring-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <Th>Title</Th>
              <Th>Type</Th>
              <Th>Status</Th>
              <Th>Owner</Th>
              <Th>Due</Th>
              {canEdit && <Th>{""}</Th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {actions.length === 0 ? (
              <tr>
                <td colSpan={canEdit ? 6 : 5} className="px-4 py-6 text-center text-slate-500">
                  No actions yet.
                </td>
              </tr>
            ) : (
              actions.map((a) => (
                <tr key={a.id} className={a.status === "COMPLETED" ? "opacity-60" : ""}>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {a.title}
                    {a.notes && <p className="text-xs text-slate-500">{a.notes}</p>}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{a.type}</td>
                  {canEdit ? (
                    <>
                      <td className="px-4 py-3">
                        <form action={updateAction} className="flex items-center gap-2">
                          <input type="hidden" name="id" value={a.id} />
                          <input type="hidden" name="ownerId" value={a.ownerId ?? ""} />
                          <select
                            name="status"
                            defaultValue={a.status}
                            className="rounded-md border border-slate-300 px-2 py-1 text-xs"
                          >
                            {STATUS_VALUES.map((s) => (
                              <option key={s} value={s}>
                                {s}
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
                      <td className="px-4 py-3">
                        <form action={updateAction} className="flex items-center gap-2">
                          <input type="hidden" name="id" value={a.id} />
                          <input type="hidden" name="status" value={a.status} />
                          <select
                            name="ownerId"
                            defaultValue={a.ownerId ?? ""}
                            className="rounded-md border border-slate-300 px-2 py-1 text-xs"
                          >
                            <option value="">— unassigned —</option>
                            {organisers.map((o) => (
                              <option key={o.id} value={o.id}>
                                {o.name}
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
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-3 text-slate-600">{a.status}</td>
                      <td className="px-4 py-3 text-slate-600">{a.owner?.name ?? "—"}</td>
                    </>
                  )}
                  <td className="px-4 py-3 text-slate-600">
                    {a.dueAt ? a.dueAt.toLocaleDateString("en-IE") : "—"}
                  </td>
                  {canEdit && (
                    <td className="px-4 py-3">
                      {a.status !== "COMPLETED" && (
                        <form action={updateAction}>
                          <input type="hidden" name="id" value={a.id} />
                          <input type="hidden" name="status" value="COMPLETED" />
                          <input type="hidden" name="ownerId" value={a.ownerId ?? ""} />
                          <button
                            type="submit"
                            className="rounded-md bg-emerald-600 px-2 py-1 text-xs font-semibold text-white hover:bg-emerald-700"
                          >
                            Mark complete
                          </button>
                        </form>
                      )}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-3 text-left font-semibold">{children}</th>;
}
