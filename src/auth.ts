import "server-only";
import { notFound } from "next/navigation";
import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import { authConfig } from "@/auth.config";
import { verifyPassword } from "@/lib/auth/password";
import { can, type Permission } from "@/lib/auth/roles";
import { normalizeEmail, toPublicUser, type PublicUser } from "@/lib/auth/users";
import { accessTo, registry, type BookAccess } from "@/lib/data/registry";

const LoginInput = z.object({ email: z.string().email(), password: z.string().min(1).max(200) });

/** Best-effort brute-force brake: 5 failures per email per 15 minutes, per server instance. */
const failures = new Map<string, { count: number; until: number }>();
const WINDOW_MS = 15 * 60 * 1000;

class TooManyAttempts extends CredentialsSignin {
  code = "rate_limited";
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw) {
        const parsed = LoginInput.safeParse(raw);
        if (!parsed.success) return null;
        const email = normalizeEmail(parsed.data.email);

        const f = failures.get(email);
        if (f && f.count >= 5 && f.until > Date.now()) throw new TooManyAttempts();

        // Read the tab fresh: a just-created or just-disabled user must count immediately.
        const user = (await registry().fresh("users")).find((u) => u.email === email);
        const ok = user && !user.disabled && (await verifyPassword(parsed.data.password, user.password_hash));
        if (!user || !ok) {
          const prev = f && f.until > Date.now() ? f.count : 0;
          failures.set(email, { count: prev + 1, until: Date.now() + WINDOW_MS });
          return null;
        }
        failures.delete(email);
        await registry()
          .update("users", user.id, { last_login_at: new Date().toISOString() })
          .catch(() => {});
        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
});

/**
 * The signed-in user, re-read from the registry's Users tab (cached ~30s) on
 * every request, so disabling takes effect without a new login.
 */
export async function currentUser(): Promise<PublicUser | null> {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;
  const user = (await registry().rows("users")).find((u) => u.id === id);
  return user && !user.disabled ? toPublicUser(user) : null;
}

export class PermissionError extends Error {}
/** Thrown when a book doesn't exist *or* the user isn't a member; both look the same to callers. */
export class BookNotFoundError extends PermissionError {
  constructor() {
    super("Book not found.");
  }
}

/** Throws unless signed in. */
export async function requireUser(): Promise<PublicUser> {
  const user = await currentUser();
  if (!user) throw new PermissionError("Your session has ended. Sign in again.");
  return user;
}

export interface BookContext extends BookAccess {
  user: PublicUser;
}

/** Signed-in member of the book (and, when given, allowed to do `permission`). */
export async function requireBook(bookId: string, permission?: Permission): Promise<BookContext> {
  const user = await requireUser();
  const access = await accessTo(user.id, bookId);
  if (!access) throw new BookNotFoundError();
  if (access.book.status !== "active") throw new PermissionError("This book is still being set up.");
  if (permission && !can(access.membership.role, permission)) throw new PermissionError("Your role doesn't allow this.");
  return { user, ...access };
}

/** For pages: like requireBook, but renders the 404 page for non-members. */
export async function requireBookPage(bookId: string): Promise<BookContext> {
  try {
    return await requireBook(bookId);
  } catch (err) {
    if (err instanceof BookNotFoundError) notFound();
    throw err;
  }
}
