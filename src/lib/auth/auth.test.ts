import { describe, expect, it } from "vitest";
import type { Membership, User } from "@/lib/sheets/schema";
import { hashPassword, passwordProblem, temporaryPassword, verifyPassword } from "./password";
import { can, PERMISSIONS } from "./roles";
import { inviteProblem, membershipChangeProblem, systemUserChangeProblem, toPublicUser } from "./users";

const user = (id: string, admin = false, disabled = false): User => ({
  id,
  email: `${id}@x.id`,
  name: id,
  password_hash: "scrypt$…",
  is_system_admin: admin,
  disabled,
  created_at: "",
  last_login_at: "",
});

const member = (user_id: string, role: Membership["role"]): Membership => ({
  id: `m-${user_id}`,
  book_id: "b1",
  user_id,
  role,
  member: "",
  last_opened_at: "",
  created_at: "",
});

describe("password", () => {
  it("hashes with a random salt and verifies", async () => {
    const a = await hashPassword("rahasia123");
    const b = await hashPassword("rahasia123");
    expect(a).not.toBe(b);
    expect(a.startsWith("scrypt$16384$8$1$")).toBe(true);
    expect(await verifyPassword("rahasia123", a)).toBe(true);
    expect(await verifyPassword("rahasia124", a)).toBe(false);
    expect(await verifyPassword("rahasia123", "plain-text")).toBe(false);
  });
  it("validates and generates passwords", () => {
    expect(passwordProblem("short")).toMatch(/at least 8/);
    expect(passwordProblem("longenough")).toBeNull();
    expect(passwordProblem(temporaryPassword())).toBeNull();
  });
});

describe("roles", () => {
  it("grants by role", () => {
    expect(can("admin", "users:manage")).toBe(true);
    expect(can("member", "data:write")).toBe(true);
    expect(can("member", "setup:write")).toBe(false);
    expect(can("viewer", "data:write")).toBe(false);
    expect(can(undefined, "data:write")).toBe(false);
    for (const roles of Object.values(PERMISSIONS)) expect(roles).toContain("admin");
  });
});

describe("book membership rules", () => {
  const members = [member("a1", "admin"), member("a2", "admin"), member("m1", "member")];
  it("keeps an admin in every book and blocks self-lockout", () => {
    expect(membershipChangeProblem(members, "a1", "a2", { role: "member" })).toBeNull();
    expect(membershipChangeProblem(members, "a1", "a1", { role: "viewer" })).toMatch(/own admin role/);
    expect(membershipChangeProblem(members, "a1", "a1", { remove: true })).toMatch(/remove yourself/);
    expect(membershipChangeProblem([members[0], members[2]], "x", "a1", { remove: true })).toMatch(/at least one admin/);
    expect(membershipChangeProblem(members, "a1", "m1", { remove: true })).toBeNull();
    expect(membershipChangeProblem(members, "a1", "nobody", { remove: true })).toMatch(/isn't in this book/);
  });
  it("personal books can't take invites", () => {
    expect(inviteProblem({ kind: "personal" })).toMatch(/private/);
    expect(inviteProblem({ kind: "family" })).toBeNull();
  });
});

describe("system user rules", () => {
  const users = [user("s1", true), user("s2", true), user("u1")];
  it("keeps at least one active system admin", () => {
    expect(systemUserChangeProblem(users, "s1", "s2", { is_system_admin: false })).toBeNull();
    expect(systemUserChangeProblem(users, "s1", "s1", { disabled: true })).toMatch(/your own account/);
    expect(systemUserChangeProblem([users[0], users[2]], "u1", "s1", { disabled: true })).toMatch(/at least one active system admin/);
  });
  it("strips the hash for the browser", () => {
    expect("password_hash" in toPublicUser(users[0])).toBe(false);
  });
});
