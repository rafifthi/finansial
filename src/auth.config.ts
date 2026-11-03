import type { NextAuthConfig } from "next-auth";
import type { Role } from "@/lib/auth/roles";

/**
 * The part of the Auth.js config that the proxy needs: no providers and no
 * sheet access, so it stays cheap on every request. The credentials provider
 * is added in auth.ts.
 */
export const authConfig = {
  pages: { signIn: "/login", error: "/login" },
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  providers: [],
  callbacks: {
    authorized: ({ auth }) => Boolean(auth?.user?.id),
    jwt({ token, user }) {
      if (user) {
        token.uid = user.id;
        token.role = (user as { role?: Role }).role;
      }
      return token;
    },
    session({ session, token }) {
      if (token.uid) session.user.id = String(token.uid);
      return session;
    },
  },
} satisfies NextAuthConfig;
