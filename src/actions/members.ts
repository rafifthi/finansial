"use server";

import { z } from "zod";
import { hashPassword, temporaryPassword } from "@/lib/auth/password";
import { inviteProblem, membershipChangeProblem, normalizeEmail } from "@/lib/auth/users";
import { bookAction } from "@/lib/data/action";
import { registry } from "@/lib/data/registry";
import { newId } from "@/lib/data/store";
import { ROLES } from "@/lib/sheets/schema";

/* People in one book. Book admins only ("users:manage" is evaluated against the book role). */

const role = z.enum(ROLES);
const member = z.string().trim().max(40).default("");

/**
 * Adds someone to the book. A new email gets an account with a one-time
 * temporary password (returned once, for the admin to pass on); an existing
 * user is simply added.
 */
export const inviteMember = bookAction(
  "users:manage",
  z.object({ email: z.string().trim().email("Enter a valid email"), name: z.string().trim().max(80).default(""), role, member }),
  async (input, { book, user }) => {
    const problem = inviteProblem(book);
    if (problem) throw new Error(problem);
    const email = normalizeEmail(input.email);
    const reg = registry();
    const [users, memberships] = await Promise.all([reg.fresh("users"), reg.fresh("memberships")]);
    let target = users.find((u) => u.email === email);
    let password: string | undefined;
    const now = new Date().toISOString();

    if (target && memberships.some((m) => m.book_id === book.id && m.user_id === target!.id)) {
      throw new Error("That person is already in this book.");
    }
    if (!target) {
      password = temporaryPassword();
      target = {
        id: newId(),
        email,
        name: input.name || email.split("@")[0],
        password_hash: await hashPassword(password),
        is_system_admin: false,
        disabled: false,
        created_at: now,
        last_login_at: "",
      };
      await reg.insert("users", [target]);
    }
    await reg.insert("memberships", [
      { id: newId(), book_id: book.id, user_id: target.id, role: input.role, member: input.member, last_opened_at: "", created_at: now },
    ]);
    await reg.insert("invites", [
      { id: newId(), book_id: book.id, email, role: input.role, invited_by: user.email, created_at: now, accepted_at: password ? "" : now },
    ]);
    return { password, existing: !password };
  },
);

export const updateMember = bookAction(
  "users:manage",
  z.object({ userId: z.string().min(1), role, member }),
  async ({ userId, ...change }, { book, user }) => {
    const members = (await registry().fresh("memberships")).filter((m) => m.book_id === book.id);
    const problem = membershipChangeProblem(members, user.id, userId, { role: change.role });
    if (problem) throw new Error(problem);
    if (book.kind === "personal" && change.role !== "admin") throw new Error("The owner of a personal book is always its admin.");
    const m = members.find((x) => x.user_id === userId)!;
    await registry().update("memberships", m.id, change);
  },
);

export const removeMember = bookAction("users:manage", z.object({ userId: z.string().min(1) }), async ({ userId }, { book, user }) => {
  const members = (await registry().fresh("memberships")).filter((m) => m.book_id === book.id);
  const problem = membershipChangeProblem(members, user.id, userId, { remove: true });
  if (problem) throw new Error(problem);
  await registry().remove("memberships", [members.find((x) => x.user_id === userId)!.id]);
});

/** Your own "I am …" household member link in this book (any role). */
export const setMyMember = bookAction(null, z.object({ member }), async ({ member }, { membership }) => {
  await registry().update("memberships", membership.id, { member });
});
