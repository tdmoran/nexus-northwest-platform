import type { OrganiserRole } from "@prisma/client";

export const MANAGEABLE_ROLES_FOR: Record<OrganiserRole, OrganiserRole[]> = {
  SUPER_ADMIN: ["SUPER_ADMIN", "ADMIN", "MANAGER", "VIEWER"],
  ADMIN: ["MANAGER", "VIEWER"],
  MANAGER: [],
  VIEWER: []
};

export function canManageRole(actorRole: OrganiserRole, targetRole: OrganiserRole): boolean {
  return MANAGEABLE_ROLES_FOR[actorRole].includes(targetRole);
}

export function canManageAnyUsers(actorRole: OrganiserRole): boolean {
  return MANAGEABLE_ROLES_FOR[actorRole].length > 0;
}
