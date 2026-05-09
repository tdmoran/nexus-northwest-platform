import { OrganiserRole } from "@prisma/client";

export type Capability =
  | "members.view"
  | "members.edit"
  | "members.edit.full"
  | "events.view"
  | "events.edit"
  | "announcements.send"
  | "announcements.broadcast"
  | "actions.view"
  | "actions.edit"
  | "users.manage.managers"
  | "users.manage.admins"
  | "settings.integrations"
  | "audit.view";

const matrix: Record<OrganiserRole, Set<Capability>> = {
  SUPER_ADMIN: new Set<Capability>([
    "members.view",
    "members.edit",
    "members.edit.full",
    "events.view",
    "events.edit",
    "announcements.send",
    "announcements.broadcast",
    "actions.view",
    "actions.edit",
    "users.manage.managers",
    "users.manage.admins",
    "settings.integrations",
    "audit.view"
  ]),
  ADMIN: new Set<Capability>([
    "members.view",
    "members.edit",
    "members.edit.full",
    "events.view",
    "events.edit",
    "announcements.send",
    "announcements.broadcast",
    "actions.view",
    "actions.edit",
    "users.manage.managers",
    "audit.view"
  ]),
  MANAGER: new Set<Capability>([
    "members.view",
    "members.edit",
    "events.view",
    "events.edit",
    "announcements.send",
    "actions.view",
    "actions.edit",
    "audit.view"
  ]),
  VIEWER: new Set<Capability>(["members.view", "events.view", "actions.view"])
};

export function can(role: OrganiserRole | undefined | null, cap: Capability): boolean {
  if (!role) return false;
  return matrix[role].has(cap);
}

export function requireCap(role: OrganiserRole | undefined | null, cap: Capability): void {
  if (!can(role, cap)) {
    const err = new Error(`Forbidden: missing capability ${cap}`);
    (err as Error & { status?: number }).status = 403;
    throw err;
  }
}
