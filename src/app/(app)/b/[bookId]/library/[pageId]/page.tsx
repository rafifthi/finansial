import type { Metadata } from "next";
import { requireBookPage } from "@/auth";
import { LibraryPage } from "@/components/app/library/library-views";
import type { LiveMode } from "@/components/app/library/use-live";
import { bookStore, libraryStore } from "@/lib/data/store";
import { liveKey } from "@/lib/library/live-key";
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
    liveMode: await liveMode(ctx.book),
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

/** Live cursors go through Liveblocks when there's a key (Settings, or the server's); in development without one, between this browser's tabs. */
async function liveMode(book: Parameters<typeof bookStore>[0]): Promise<LiveMode> {
  if ((await liveKey(bookStore(book))).key) return "liveblocks";
  return process.env.NODE_ENV === "development" ? "tabs" : "off";
}

export default async function LibraryPageRoute(props: Props) {
  const { pageId, page, rows, comments, liveMode } = await load(props);
  return <LibraryPage id={pageId} page={page} rows={rows} comments={comments} liveMode={liveMode} />;
}
