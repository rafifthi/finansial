"use client";

import { useState } from "react";
import { RiChat3Line, RiCheckLine, RiDeleteBinLine, RiMoreLine, RiPencilLine, RiReplyLine, RiRestartLine } from "@remixicon/react";
import { Avatar } from "@/components/base/avatar/avatar";
import { Button } from "@/components/base/buttons/button";
import { Drawer, DrawerBody, DrawerHeader } from "@/components/base/drawer/drawer";
import { Dropdown, DropdownItem, DropdownPopover, DropdownTrigger } from "@/components/base/dropdown/dropdown";
import { SegmentedControl, SegmentedControlItem } from "@/components/base/segmented-control/segmented-control";
import { Textarea } from "@/components/base/textarea/textarea";
import type { Thread } from "@/lib/library/comments";
import type { PageComment } from "@/lib/sheets/schema";
import { cx } from "@/utils/cx";
import type { CommentsApi } from "./use-comments";

const MINUTE = 60_000;

/** "just now", "5 min ago", "3 h ago", then a date. */
export function when(iso: string, now = Date.now()) {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const ago = now - t;
  if (ago < MINUTE) return "just now";
  if (ago < 60 * MINUTE) return `${Math.floor(ago / MINUTE)} min ago`;
  if (ago < 24 * 60 * MINUTE) return `${Math.floor(ago / (60 * MINUTE))} h ago`;
  return new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: new Date(t).getFullYear() === new Date(now).getFullYear() ? undefined : "numeric" });
}

const initials = (name: string, email: string) => (name || email).trim().slice(0, 1).toUpperCase() || "?";

export interface CommentContext {
  api: CommentsApi;
  me: string;
  canEdit: boolean;
}

/** Text box with a send button; ⌘/Ctrl+Enter sends. */
function Composer({ label, placeholder, onSend, onCancel, initial = "", submit = "Comment", autoFocus }: { label: string; placeholder: string; onSend: (body: string) => Promise<boolean>; onCancel?: () => void; initial?: string; submit?: string; autoFocus?: boolean }) {
  const [body, setBody] = useState(initial);
  const [sending, setSending] = useState(false);
  const send = async () => {
    if (!body.trim() || sending) return;
    setSending(true);
    const ok = await onSend(body);
    setSending(false);
    if (ok) setBody("");
  };
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        void send();
      }}
    >
      <Textarea
        aria-label={label}
        placeholder={placeholder}
        value={body}
        onChange={setBody}
        autoResize
        rows={2}
        maxRows={10}
        maxLength={5000}
        autoFocus={autoFocus}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            void send();
          } else if (e.key === "Escape" && onCancel) {
            onCancel();
          } else {
            // React Aria stops key events at fields with their own handler; let Escape reach the drawer.
            e.continuePropagation();
          }
        }}
      />
      <div className="flex justify-end gap-2">
        {onCancel ? (
          <Button type="button" variant="secondary" size="small" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
        <Button type="submit" size="small" disabled={!body.trim() || sending}>
          {submit}
        </Button>
      </div>
    </form>
  );
}

function CommentItem({ comment, ctx, isRoot, thread }: { comment: PageComment; ctx: CommentContext; isRoot: boolean; thread: Thread }) {
  const [editing, setEditing] = useState(false);
  const [menu, setMenu] = useState(false);
  const mine = comment.created_by === ctx.me;
  const edited = comment.updated_at && comment.created_at && comment.updated_at.slice(0, 16) !== comment.created_at.slice(0, 16) && !comment.resolved_at;

  if (comment.deleted) {
    return <p className="py-1 text-body-2-regular italic text-text-tertiary">Comment deleted</p>;
  }
  return (
    <div className="flex gap-2.5">
      <Avatar size="sm" initials={initials(comment.author_name, comment.created_by)} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-body-semibold text-text-primary">{comment.author_name || comment.created_by}</span>
          <span className="shrink-0 text-body-2-regular text-text-tertiary">
            {when(comment.created_at)}
            {edited ? " · edited" : ""}
          </span>
          <span className="ms-auto flex shrink-0 items-center gap-0.5">
            {isRoot && ctx.canEdit ? (
              <button
                type="button"
                onClick={() => void ctx.api.resolve(comment.id, !thread.root.resolved)}
                aria-label={thread.root.resolved ? "Reopen thread" : "Resolve thread"}
                title={thread.root.resolved ? "Reopen" : "Resolve"}
                className="flex size-6 cursor-pointer items-center justify-center rounded-md text-foreground-icon-tertiary outline-none hover:bg-background-secondary-hover hover:text-foreground-icon-primary focus-visible:ring-2 focus-visible:ring-border-focus-ring max-sm:size-9"
              >
                {thread.root.resolved ? <RiRestartLine className="size-4" aria-hidden /> : <RiCheckLine className="size-4" aria-hidden />}
              </button>
            ) : null}
            {mine && ctx.canEdit ? (
              <Dropdown isOpen={menu} onOpenChange={setMenu}>
                <DropdownTrigger aria-label="Comment actions" className="flex size-6 items-center justify-center rounded-md text-foreground-icon-tertiary hover:bg-background-secondary-hover hover:text-foreground-icon-primary max-sm:size-9">
                  <RiMoreLine className="size-4" aria-hidden />
                </DropdownTrigger>
                <DropdownPopover aria-label="Comment actions" placement="bottom end" className="w-44">
                  <DropdownItem
                    className="py-1.5"
                    onSelect={() => {
                      setMenu(false);
                      setEditing(true);
                    }}
                  >
                    <RiPencilLine className="size-4 text-foreground-icon-secondary" aria-hidden />
                    <span className="text-body-medium">Edit</span>
                  </DropdownItem>
                  <DropdownItem
                    className="py-1.5"
                    onSelect={() => {
                      setMenu(false);
                      void ctx.api.remove(comment.id);
                    }}
                  >
                    <RiDeleteBinLine className="size-4 text-foreground-icon-error" aria-hidden />
                    <span className="text-body-medium text-text-error-primary">Delete</span>
                  </DropdownItem>
                </DropdownPopover>
              </Dropdown>
            ) : null}
          </span>
        </div>
        {editing ? (
          <Composer
            label="Edit comment"
            placeholder=""
            initial={comment.body}
            submit="Save"
            autoFocus
            onCancel={() => setEditing(false)}
            onSend={async (body) => {
              setEditing(false);
              return ctx.api.edit(comment.id, body);
            }}
          />
        ) : (
          <p className="whitespace-pre-wrap break-words text-body-regular text-text-primary">{comment.body}</p>
        )}
      </div>
    </div>
  );
}

/** One thread: what it's about, the comments in order, then reply. */
export function CommentThread({ thread, ctx, showQuote, orphaned }: { thread: Thread; ctx: CommentContext; showQuote?: boolean; orphaned?: boolean }) {
  const [replying, setReplying] = useState(false);
  const { root } = thread;
  return (
    <article
      aria-label={`Comment by ${root.author_name || root.created_by}`}
      className={cx("flex flex-col gap-3 rounded-2xl border border-separator-border bg-background-primary-default p-3", root.resolved && "opacity-70")}
    >
      {showQuote && root.quote ? (
        <blockquote className="border-s-2 border-border-button-default ps-2 text-body-2-regular text-text-secondary">
          {orphaned ? <span className="block text-caption-1-medium text-text-tertiary">On deleted content</span> : null}
          <span className="line-clamp-3">{root.quote}</span>
        </blockquote>
      ) : null}
      {root.resolved ? (
        <span className="flex items-center gap-1 text-caption-1-medium text-text-tertiary">
          <RiCheckLine className="size-3.5" aria-hidden />
          Resolved
        </span>
      ) : null}
      <CommentItem comment={root} ctx={ctx} isRoot thread={thread} />
      {thread.replies.map((r) => (
        <CommentItem key={r.id} comment={r} ctx={ctx} isRoot={false} thread={thread} />
      ))}
      {ctx.canEdit && !root.resolved ? (
        replying ? (
          <Composer label="Reply" placeholder="Reply…" submit="Reply" autoFocus onCancel={() => setReplying(false)} onSend={async (body) => {
              const ok = await ctx.api.add({ parent_id: root.id, body });
              if (ok) setReplying(false);
              return ok;
            }}
          />
        ) : (
          <button
            type="button"
            onClick={() => setReplying(true)}
            className="flex w-fit cursor-pointer items-center gap-1 rounded-md text-body-2-medium text-text-tertiary outline-none hover:text-text-secondary focus-visible:ring-2 focus-visible:ring-border-focus-ring max-sm:min-h-9"
          >
            <RiReplyLine className="size-3.5" aria-hidden />
            Reply
          </button>
        )
      ) : null}
    </article>
  );
}

type Filter = "open" | "resolved";

function ThreadList({ threads, ctx, empty, showQuote, orphaned = [] }: { threads: Thread[]; ctx: CommentContext; empty: string; showQuote?: boolean; orphaned?: Thread[] }) {
  const [filter, setFilter] = useState<Filter>("open");
  const all = [...threads, ...orphaned];
  const resolvedCount = all.filter((t) => t.root.resolved).length;
  const shown = (list: Thread[]) => list.filter((t) => (filter === "open" ? !t.root.resolved : t.root.resolved));
  return (
    <div className="flex flex-col gap-3">
      {resolvedCount ? (
        <SegmentedControl
          aria-label="Show"
          className="w-fit"
          selectedKeys={new Set([filter])}
          onSelectionChange={(keys) => {
            const next = [...keys][0];
            if (next) setFilter(next as Filter);
          }}
        >
          <SegmentedControlItem id="open">Open ({all.length - resolvedCount})</SegmentedControlItem>
          <SegmentedControlItem id="resolved">Resolved ({resolvedCount})</SegmentedControlItem>
        </SegmentedControl>
      ) : null}
      {shown(threads).map((t) => (
        <CommentThread key={t.root.id} thread={t} ctx={ctx} showQuote={showQuote} />
      ))}
      {shown(orphaned).map((t) => (
        <CommentThread key={t.root.id} thread={t} ctx={ctx} showQuote orphaned />
      ))}
      {!shown(threads).length && !shown(orphaned).length ? <p className="py-2 text-body-2-regular text-text-tertiary">{filter === "resolved" ? "No resolved comments." : resolvedCount ? "No open comments." : empty}</p> : null}
    </div>
  );
}

/** The comments on one block, in a side drawer (a sheet from the bottom on phones). */
export function BlockCommentsDrawer({
  open,
  onOpenChange,
  quote,
  threads,
  ctx,
  onNew,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quote: string;
  threads: Thread[];
  ctx: CommentContext;
  onNew: (body: string) => Promise<boolean>;
}) {
  return (
    <Drawer isOpen={open} onOpenChange={onOpenChange} placement="end" size="md" aria-label="Comments on this block" className="flex h-full flex-col rounded-3xl bg-background-primary-default">
      <DrawerHeader title="Comments" />
      <DrawerBody className="flex flex-col gap-4 overflow-y-auto">
        {quote ? <blockquote className="border-s-2 border-border-button-default ps-3 text-body-regular text-text-secondary line-clamp-4">{quote}</blockquote> : null}
        {ctx.canEdit ? <Composer label="New comment" placeholder="Add a comment…" autoFocus={!threads.length} onSend={onNew} /> : null}
        <ThreadList threads={threads} ctx={ctx} empty={ctx.canEdit ? "No comments on this block yet." : "No comments on this block."} />
      </DrawerBody>
    </Drawer>
  );
}

/** Comments about the whole page, plus threads whose block was deleted, under the page. */
export function PageComments({ threads, orphaned, ctx }: { threads: Thread[]; orphaned: Thread[]; ctx: CommentContext }) {
  const open = [...threads, ...orphaned].filter((t) => !t.root.resolved).length;
  return (
    <section aria-labelledby="page-comments" className="flex flex-col gap-3 border-t border-separator-border pt-6">
      <h2 id="page-comments" className="flex items-center gap-2 text-title-3-semibold text-text-primary">
        <RiChat3Line className="size-4 text-foreground-icon-secondary" aria-hidden />
        Comments{open ? <span className="text-text-tertiary">{open}</span> : null}
      </h2>
      {ctx.canEdit ? <Composer label="Comment on this page" placeholder="Comment on this page…" onSend={(body) => ctx.api.add({ body })} /> : null}
      <ThreadList threads={threads} orphaned={orphaned} ctx={ctx} empty={ctx.canEdit ? "No comments yet. Ask a question or leave a note for the household." : "No comments yet."} />
    </section>
  );
}
