import type { Metadata } from "next";
import { requireBookPage } from "@/auth";
import { LibraryPage } from "@/components/app/library/library-views";
import { libraryStore } from "@/lib/data/store";
import { pageTitle } from "@/lib/library/tree";

type Props = PageProps<"/b/[bookId]/library/[pageId]">;

async function load({ params }: Props) {
  const { bookId, pageId } = await params;
  const ctx = await requireBookPage(bookId);
  const store = await libraryStore(ctx.book);
  // Fresh reads: the 30s cache could be behind a save made on another server instance.
  const [pages, blocks, comments] = await Promise.all([store.fresh("pages"), store.fresh("blocks"), store.fresh("comments")]);
  return {
    pageId,
    page: pages.find((p) => p.id === pageId) ?? null,
    rows: blocks.filter((b) => b.page_id === pageId),
    comments: comments.filter((c) => c.page_id === pageId),
  };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { bookId, pageId } = await params;
  const ctx = await requireBookPage(bookId);
  const page = (await (await libraryStore(ctx.book)).rows("pages")).find((p) => p.id === pageId);
  return { title: page ? pageTitle(page) : "Library" };
}

export default async function LibraryPageRoute(props: Props) {
  const { pageId, page, rows, comments } = await load(props);
  return <LibraryPage id={pageId} page={page} rows={rows} comments={comments} />;
}
