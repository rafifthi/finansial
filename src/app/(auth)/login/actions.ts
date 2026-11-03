"use server";

import { AuthError, CredentialsSignin } from "next-auth";
import { signIn } from "@/auth";

export interface LoginState {
  error?: string;
  email?: string;
}

/** Only same-site relative paths, so the login form can't be used as an open redirect. */
function safeNext(value: FormDataEntryValue | null) {
  const s = typeof value === "string" ? value : "";
  return s.startsWith("/") && !s.startsWith("//") && !s.startsWith("/login") ? s : "/";
}

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "");
  try {
    await signIn("credentials", {
      email,
      password: String(formData.get("password") ?? ""),
      redirectTo: safeNext(formData.get("next")),
    });
    return {};
  } catch (err) {
    // A successful signIn throws Next's redirect, which must propagate.
    if (!(err instanceof AuthError)) throw err;
    if (err instanceof CredentialsSignin) {
      return {
        email,
        error: err.code === "rate_limited" ? "Too many attempts. Try again in 15 minutes." : "Wrong email or password.",
      };
    }
    console.error(err);
    return { email, error: "Couldn't sign in right now. Is the database sheet reachable?" };
  }
}
