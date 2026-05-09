import { describe, it, expect } from "vitest";
import { can, requireCap } from "./rbac";

describe("rbac.can", () => {
  it("Super Admin can do everything", () => {
    expect(can("SUPER_ADMIN", "users.manage.admins")).toBe(true);
    expect(can("SUPER_ADMIN", "settings.integrations")).toBe(true);
    expect(can("SUPER_ADMIN", "audit.view")).toBe(true);
  });

  it("Admin cannot manage admins or configure integrations", () => {
    expect(can("ADMIN", "users.manage.admins")).toBe(false);
    expect(can("ADMIN", "settings.integrations")).toBe(false);
  });

  it("Admin can manage managers and view audit", () => {
    expect(can("ADMIN", "users.manage.managers")).toBe(true);
    expect(can("ADMIN", "audit.view")).toBe(true);
  });

  it("Manager can edit events + send announcements but not broadcast", () => {
    expect(can("MANAGER", "events.edit")).toBe(true);
    expect(can("MANAGER", "announcements.send")).toBe(true);
    expect(can("MANAGER", "announcements.broadcast")).toBe(false);
  });

  it("Viewer is read-only", () => {
    expect(can("VIEWER", "events.view")).toBe(true);
    expect(can("VIEWER", "members.view")).toBe(true);
    expect(can("VIEWER", "events.edit")).toBe(false);
    expect(can("VIEWER", "announcements.send")).toBe(false);
    expect(can("VIEWER", "actions.edit")).toBe(false);
  });

  it("returns false for null/undefined role", () => {
    expect(can(null, "events.view")).toBe(false);
    expect(can(undefined, "events.view")).toBe(false);
  });
});

describe("rbac.requireCap", () => {
  it("throws 403 for missing capability", () => {
    expect(() => requireCap("VIEWER", "events.edit")).toThrow(/Forbidden/);
  });

  it("does not throw when capability is present", () => {
    expect(() => requireCap("MANAGER", "events.edit")).not.toThrow();
  });
});
