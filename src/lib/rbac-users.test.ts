import { describe, it, expect } from "vitest";
import { canManageRole, canManageAnyUsers, MANAGEABLE_ROLES_FOR } from "./rbac-users";

describe("rbac-users", () => {
  it("Super Admin can manage every role including other Super Admins", () => {
    expect(canManageRole("SUPER_ADMIN", "SUPER_ADMIN")).toBe(true);
    expect(canManageRole("SUPER_ADMIN", "ADMIN")).toBe(true);
    expect(canManageRole("SUPER_ADMIN", "MANAGER")).toBe(true);
    expect(canManageRole("SUPER_ADMIN", "VIEWER")).toBe(true);
  });

  it("Admin can manage Managers and Viewers but not other Admins", () => {
    expect(canManageRole("ADMIN", "MANAGER")).toBe(true);
    expect(canManageRole("ADMIN", "VIEWER")).toBe(true);
    expect(canManageRole("ADMIN", "ADMIN")).toBe(false);
    expect(canManageRole("ADMIN", "SUPER_ADMIN")).toBe(false);
  });

  it("Manager and Viewer cannot manage anyone", () => {
    expect(canManageAnyUsers("MANAGER")).toBe(false);
    expect(canManageAnyUsers("VIEWER")).toBe(false);
    expect(canManageRole("MANAGER", "VIEWER")).toBe(false);
  });

  it("MANAGEABLE_ROLES_FOR matrix is internally consistent", () => {
    for (const [actor, targets] of Object.entries(MANAGEABLE_ROLES_FOR)) {
      for (const t of targets) {
        expect(canManageRole(actor as never, t)).toBe(true);
      }
    }
  });
});
