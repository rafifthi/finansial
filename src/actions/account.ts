"use server";

import { z } from "zod";
import { hashPassword, passwordProblem, verifyPassword } from "@/lib/auth/password";
import { userAction } from "@/lib/data/action";
import { registry } from "@/lib/data/registry";

/* Your own account (any signed-in user). */

export const updateProfile = userAction(z.object({ name: z.string().trim().min(1, "Enter a name").max(80) }), async ({ name }, user) => {
  await registry().update("users", user.id, { name });
});

export const changePassword = userAction(
  z.object({ current: z.string().min(1, "Enter your current password"), next: z.string() }),
  async ({ current, next }, user) => {
    const problem = passwordProblem(next);
    if (problem) throw new Error(problem);
    const stored = (await registry().fresh("users")).find((u) => u.id === user.id);
    if (!stored || !(await verifyPassword(current, stored.password_hash))) throw new Error("Current password is wrong.");
    await registry().update("users", user.id, { password_hash: await hashPassword(next) });
  },
);
