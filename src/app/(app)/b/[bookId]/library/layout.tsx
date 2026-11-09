import { requireBookPage } from "@/auth";
import { LibraryShell } from "@/components/app/library/library-views";
import { can } from "@/lib/auth/roles";
import { registry } from "@/lib/data/registry";
import { libraryStore } from "@/lib/data/store";

/** Reads only the Pages tab's list; the tree keeps its own state after this first load. */
export default async function LibraryLayout({ children, params }: LayoutProps<"/b/[bookId]/library">) {
  const ctx = await requireBookPage((await params).bookId);
  const [pages, users, memberships] = await Promise.all([
    libraryStore(ctx.book).then((s) => s.rows("pages")),
    registry().rows("users"),
    registry().rows("memberships"),
  ]);
  // Everyone who can open the book, for @mentions. Only names and ids go to the browser.
  const byId = new Map(users.map((u) => [u.id, u]));
  const members = memberships
    .filter((m) => m.book_id === ctx.book.id && byId.has(m.user_id))
    .map((m) => ({ id: m.user_id, name: byId.get(m.user_id)!.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return (
    <LibraryShell initial={pages} canEdit={can(ctx.membership.role, "data:write")} user={ctx.user.email} userName={ctx.user.name} userId={ctx.user.id} members={members}>
      {children}
    </LibraryShell>
  );
}
