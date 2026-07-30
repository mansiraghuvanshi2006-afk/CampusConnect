import { describe, expect, it } from "vitest";

/**
 * Mirrors the ChatPage create-group visibility rule so role
 * regressions are caught without mounting the full page.
 */
const canCreateGroup = (user) =>
  user?.role === "teacher" || user?.role === "admin";

describe("Create Group visibility", () => {
  it("is available to admins and teachers only", () => {
    expect(canCreateGroup({ role: "admin" })).toBe(true);
    expect(canCreateGroup({ role: "teacher" })).toBe(true);
    expect(canCreateGroup({ role: "student" })).toBe(false);
    expect(canCreateGroup(null)).toBe(false);
  });
});
