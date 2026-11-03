"use server";

import { z } from "zod";
import { PermissionError } from "@/auth";
import { hashPassword, temporaryPassword } from "@/lib/auth/password";
import { systemUserChangeProblem } from "@/lib/auth/users";
import { userAction } from "@/lib/data/action";
import { registry } from "@/lib/data/registry";

/* Deployment-wide user management. System admins only; grants no access to anyone's books. */

function assertSystemAdmin(user: { is_system_admin: boolean }) {
  if (!user.is_system_admin) throw new PermissionError("Only a system admin can do this.");
}

export const setUserFlags = userAction(
  z.object({ id: z.string().min(1), disabled: z.boolean().optional(), is_system_admin: z.boolean().optional() }),
  async ({ id, ...change }, actor) => {
    assertSystemAdmin(actor);
    const users = await registry().fresh("users");
    const problem = systemUserChangeProblem(users, actor.id, id, change);
    if (problem) throw new Error(problem);
    await registry().update("users", id, change);
  },
);

export const resetUserPassword = userAction(z.object({ id: z.string().min(1) }), async ({ id }, actor) => {
  assertSystemAdmin(actor);
  const password = temporaryPassword();
  await registry().update("users", id, { password_hash: await hashPassword(password) });
  return { password };
});
