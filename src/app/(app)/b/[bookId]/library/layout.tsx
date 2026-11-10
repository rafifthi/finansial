import { requireBookPage } from "@/auth";
import { LibraryShell } from "@/components/app/library/library-views";
import { can } from "@/lib/auth/roles";
import { mentionInbox } from "@/lib/data/library-inbox";
import { registry } from "@/lib/data/registry";
import { libraryStore } from "@/lib/data/store";

/** Reads only the Pages tab's list; the tree keeps its own state after this first load. */
export default async function LibraryLayout({ children, params }: LayoutProps<"/b/[bookId]/library">) {
  const ctx = await requireBookPage((await params).bookId);
  const store = await libraryStore(ctx.book);
  const [pages, users, memberships, inbox] = await Promise.all([
    store.rows("pages"),
    registry().rows("users"),
    registry().rows("memberships"),
    mentionInbox(store, ctx.user),
  ]);
  // Everyone who can open the book, for @mentions and for naming who changed what.
  const byId = new Map(users.map((u) => [u.id, u]));
  const members = memberships
    .filter((m) => m.book_id === ctx.book.id && byId.has(m.user_id))
    .map((m) => ({ id: m.user_id, name: byId.get(m.user_id)!.name, email: byId.get(m.user_id)!.email }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return (
    <LibraryShell initial={pages} canEdit={can(ctx.membership.role, "data:write")} user={ctx.user.email} userName={ctx.user.name} userId={ctx.user.id} members={members} unread={inbox.items.filter((i) => i.unread).length}>
      {children}
    </LibraryShell>
  );
}
