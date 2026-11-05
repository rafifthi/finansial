import type { ReactNode } from "react";
import { signOut, type BookContext } from "@/auth";
import type { PublicUser } from "@/lib/auth/users";
import { formOptions, loadAppData, type FormOptions } from "@/lib/data/app-data";
import { booksOf } from "@/lib/data/registry";
import { AppSidebar } from "./app-sidebar";
import type { ShellBook } from "./book-switcher";
import { PermissionsProvider } from "./permissions";
import { RememberBook } from "./remember-book";
import { SetupNotice } from "./setup-notice";

async function signOutAction() {
  "use server";
  await signOut({ redirectTo: "/login" });
}

/**
 * Sidebar + content frame. Inside a book (`current`) it adds the book's nav,
 * the reconcile badge, the Catat button and the role context for client
 * components; on account pages it shows account navigation only.
 */
export async function AppShell({ user, current, children }: { user: PublicUser; current?: BookContext; children: ReactNode }) {
  const access = await booksOf(user.id);
  const books: ShellBook[] = access.map(({ book, membership }) => ({
    id: book.id,
    name: book.name,
    kind: book.kind,
    role: membership.role,
    provisioning: book.status !== "active",
  }));

  let unverified: number | undefined;
  let quickAdd: FormOptions | undefined;
  let setupError: string | undefined;
  if (current) {
    try {
      const data = await loadAppData(current);
      unverified = data.transactions.filter((t) => !t.verified).length;
      quickAdd = formOptions(data);
    } catch (err) {
      setupError = err instanceof Error ? err.message : String(err);
    }
  }
  const currentShell = current ? books.find((b) => b.id === current.book.id) : undefined;

  const frame = (
    <div className="flex min-h-dvh flex-col gap-2 lg:flex-row lg:bg-background-canvas lg:p-2">
      <AppSidebar
        user={{ name: user.name, email: user.email, isSystemAdmin: user.is_system_admin }}
        books={books}
        current={currentShell}
        badges={{ unverified }}
        signOutAction={signOutAction}
        quickAdd={quickAdd}
      />
      {/* Bottom padding clears the phone tab bar (and the home indicator). */}
      {/* Desktop: Linear's work panel, a lifted plane with a hairline edge beside the flat sidebar. */}
      <main className="flex min-w-0 flex-1 flex-col gap-4 px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-4 lg:rounded-3xl lg:border lg:border-separator-border lg:bg-background-full lg:px-5 lg:pt-4 lg:pb-8">
        {setupError ? <SetupNotice message={setupError} /> : children}
      </main>
    </div>
  );

  if (!current) return frame;
  return (
    <PermissionsProvider
      bookId={current.book.id}
      bookName={current.book.name}
      bookKind={current.book.kind}
      role={current.membership.role}
      member={current.membership.member}
    >
      <RememberBook bookId={current.book.id} />
      {frame}
    </PermissionsProvider>
  );
}
