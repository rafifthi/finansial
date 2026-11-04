import type { Metadata } from "next";
import { requireBookPage } from "@/auth";
import { PageHeader } from "@/components/app/page-header";
import { SmartAdd, type SmartAddBook } from "@/components/app/smart-add";
import { can } from "@/lib/auth/roles";
import { formOptions, loadAppData } from "@/lib/data/app-data";
import { booksOf } from "@/lib/data/registry";

export const metadata: Metadata = { title: "Catat" };

export default async function CatatPage({ params }: PageProps<"/b/[bookId]/catat">) {
  const ctx = await requireBookPage((await params).bookId);
  // Every book the user can add to, for the "Save to" picker; this one first.
  const writable = (await booksOf(ctx.user.id)).filter(
    (a) => a.book.status === "active" && a.book.spreadsheet_id && can(a.membership.role, "data:write"),
  );
  const books: SmartAddBook[] = (
    await Promise.all(
      writable.map(async (access) => {
        try {
          return { id: access.book.id, name: access.book.name, options: formOptions(await loadAppData(access)) };
        } catch {
          return null;
        }
      }),
    )
  )
    .filter((b): b is SmartAddBook => b !== null)
    .sort((a, b) => Number(b.id === ctx.book.id) - Number(a.id === ctx.book.id));

  return (
    <>
      <PageHeader title="Catat" description="Type, talk, or snap a receipt. Check the drafts, then save." />
      {books.length ? (
        <SmartAdd books={books} initialBookId={books.some((b) => b.id === ctx.book.id) ? ctx.book.id : books[0].id} />
      ) : (
        <p className="text-body-regular text-text-secondary">You can only view your books, so there&apos;s nowhere to add transactions.</p>
      )}
    </>
  );
}
