import { requireBookPage } from "@/auth";
import { LibraryShell } from "@/components/app/library/library-views";
import { can } from "@/lib/auth/roles";
import { libraryStore } from "@/lib/data/store";

/** Reads only the Pages tab's list; the tree keeps its own state after this first load. */
export default async function LibraryLayout({ children, params }: LayoutProps<"/b/[bookId]/library">) {
  const ctx = await requireBookPage((await params).bookId);
  const pages = await (await libraryStore(ctx.book)).rows("pages");
  return (
    <LibraryShell initial={pages} canEdit={can(ctx.membership.role, "data:write")} user={ctx.user.email} userName={ctx.user.name}>
      {children}
    </LibraryShell>
  );
}
