import "server-only";
import { mentionsOf } from "@/lib/library/mentions";
import type { libraryStore } from "./store";

type LibraryStore = Awaited<ReturnType<typeof libraryStore>>;

/** Everything in the Library that mentions the person, and when they last looked (one cached read). */
export async function mentionInbox(store: LibraryStore, user: { id: string; email: string }) {
  const snap = await store.snapshot();
  const seenAt = snap.reads.rows.find((r) => r.data.user_id === user.id)?.data.mentions_seen_at ?? "";
  const data = {
    pages: snap.pages.rows.map((r) => r.data),
    blocks: snap.blocks.rows.map((r) => r.data),
    comments: snap.comments.rows.map((r) => r.data),
  };
  return { items: mentionsOf(user, data, seenAt), seenAt };
}
