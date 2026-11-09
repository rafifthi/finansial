"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RiAtLine } from "@remixicon/react";
import { markMentionsSeen } from "@/actions/library";
import { Avatar } from "@/components/base/avatar/avatar";
import type { MentionItem } from "@/lib/library/mentions";
import { cx } from "@/utils/cx";
import { EmptyState } from "../card";
import { PageHeader } from "../page-header";
import { useBookId } from "../permissions";
import { when } from "./comments";
import { useLibrary } from "./library-context";

export type InboxItem = Omit<MentionItem, "by"> & { byName: string };

const PANEL = "rounded-3xl border border-separator-border bg-background-primary-default";

/** Where an item opens: its thread in the comments panel, or its block in the page. */
function target(base: string, item: InboxItem) {
  const page = `${base}/${item.pageId}`;
  return item.kind === "comment" ? `${page}?thread=${encodeURIComponent(item.threadId ?? item.id)}` : `${page}?block=${encodeURIComponent(item.id)}`;
}

function Row({ item, base }: { item: InboxItem; base: string }) {
  return (
    <li className="border-b border-separator-border last:border-b-0">
      <Link
        href={target(base, item)}
        className="flex gap-3 px-4 py-3 outline-none transition-colors hover:bg-background-secondary-hover focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-border-focus-ring"
      >
        <Avatar size="md" initials={item.byName.slice(0, 1).toUpperCase()} />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex items-baseline gap-2">
            <span className="min-w-0 truncate text-body-regular text-text-secondary">
              <span className="text-body-semibold text-text-primary">{item.byName}</span>
              {item.kind === "comment" ? " mentioned you in a comment on " : " mentioned you in "}
              <span className="text-body-medium text-text-primary">{item.pageTitle}</span>
            </span>
            <span className="ms-auto shrink-0 text-body-2-regular text-text-tertiary">{when(item.at)}</span>
          </span>
          <span className="line-clamp-2 whitespace-pre-line text-body-regular text-text-secondary">{item.text}</span>
        </span>
        {item.unread ? <span className="mt-2 size-2 shrink-0 rounded-full bg-accent-solid" aria-label="New" /> : <span className="size-2 shrink-0" aria-hidden />}
      </Link>
    </li>
  );
}

/**
 * Pages and comments that mention you, newest first, the new ones on top.
 * Opening it marks them all read (on every device); the dots stay until you leave.
 */
export function MentionsInbox({ items }: { items: InboxItem[] }) {
  const bookId = useBookId();
  const { href, clearUnread } = useLibrary();
  const base = href();

  useEffect(() => {
    clearUnread();
    void markMentionsSeen(bookId, {});
  }, [bookId, clearUnread]);

  const fresh = items.filter((i) => i.unread);
  const earlier = items.filter((i) => !i.unread);
  const section = (title: string, list: InboxItem[], id: string) =>
    list.length ? (
      <section aria-labelledby={id} className="flex flex-col gap-2">
        <h2 id={id} className="px-1 text-caption-1-semibold text-text-tertiary">
          {title}
        </h2>
        <ul className={cx(PANEL, "flex flex-col overflow-hidden")}>
          {list.map((i) => (
            <Row key={`${i.kind}-${i.id}`} item={i} base={base} />
          ))}
        </ul>
      </section>
    ) : null;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 sm:gap-6">
      <PageHeader title="Mentions" description="Pages and comments in the Library that mention you." />
      {items.length ? (
        <>
          {section("New", fresh, "mentions-new")}
          {section(fresh.length ? "Earlier" : "All mentions", earlier, "mentions-earlier")}
        </>
      ) : (
        <EmptyState>
          <span className="flex flex-col items-center gap-2">
            <RiAtLine className="size-5 text-foreground-icon-tertiary" aria-hidden />
            When someone types @ and your name in a page or a comment, it shows up here.
          </span>
        </EmptyState>
      )}
    </div>
  );
}
