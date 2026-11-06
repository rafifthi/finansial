import type { Metadata } from "next";
import { requireBookPage } from "@/auth";
import { ListsView } from "@/components/app/lists/lists-view";
import { can } from "@/lib/auth/roles";
import { listStore } from "@/lib/data/store";
import { today } from "@/lib/finance/dates";

export const metadata: Metadata = { title: "Lists" };

/** Reads only the Lists tabs; the screen keeps its own state after this first load. */
export default async function ListsPage({ params }: PageProps<"/b/[bookId]/lists">) {
  const ctx = await requireBookPage((await params).bookId);
  const snap = await (await listStore(ctx.book)).snapshot();
  return (
    <ListsView
      initial={{ lists: snap.lists.rows.map((r) => r.data), items: snap.items.rows.map((r) => r.data) }}
      today={today()}
      canEdit={can(ctx.membership.role, "data:write")}
      user={ctx.user.email}
      personal={ctx.book.kind === "personal"}
    />
  );
}
