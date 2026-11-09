import type { Metadata } from "next";
import { requireBookPage } from "@/auth";
import { MentionsInbox } from "@/components/app/library/mentions-inbox";
import { mentionInbox } from "@/lib/data/library-inbox";
import { registry } from "@/lib/data/registry";
import { libraryStore } from "@/lib/data/store";

export const metadata: Metadata = { title: "Mentions" };

export default async function LibraryMentionsPage({ params }: PageProps<"/b/[bookId]/library/mentions">) {
  const ctx = await requireBookPage((await params).bookId);
  const [inbox, users] = await Promise.all([libraryStore(ctx.book).then((s) => mentionInbox(s, ctx.user)), registry().rows("users")]);
  // Who wrote each mention, by name; only names go to the browser, never other people's emails.
  const names = new Map(users.map((u) => [u.email, u.name]));
  const items = inbox.items.map(({ by, ...item }) => ({ ...item, byName: names.get(by) ?? "Someone" }));
  return <MentionsInbox items={items} />;
}
