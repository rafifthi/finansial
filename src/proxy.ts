import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// Only checks that a valid session cookie exists; roles and disabled users are
// enforced in the app layout and in every server action (see requireUser).
const { auth } = NextAuth(authConfig);
export default auth;

export const config = {
  // Everything except auth endpoints, the cron hook, the login page and static assets.
  matcher: ["/((?!api/auth|api/cron|login|_next/static|_next/image|favicon.ico|manifest.webmanifest|icon).*)"],
};
