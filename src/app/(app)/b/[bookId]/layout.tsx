import { redirect } from "next/navigation";
import { PermissionError, requireBookPage } from "@/auth";
import { AppShell } from "@/components/app/app-shell";
import { touchMembership } from "@/lib/data/registry";

export default async function BookLayout({ children, params }: LayoutProps<"/b/[bookId]">) {
  const { bookId } = await params;
  let ctx;
  try {
    ctx = await requireBookPage(bookId);
  } catch (err) {
    // Members of a book that is still being set up go back to the wizard.
    if (err instanceof PermissionError) redirect(`/books/new?resume=${encodeURIComponent(bookId)}`);
    throw err;
  }
  void touchMembership(ctx.membership);
  return (
    <AppShell user={ctx.user} current={ctx}>
      {children}
    </AppShell>
  );
}
