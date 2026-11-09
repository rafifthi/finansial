"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { RiAddLine, RiCheckLine, RiCloseLine, RiDeleteBinLine, RiMoreLine, RiPencilLine, RiReplyLine, RiRestartLine } from "@remixicon/react";
import { Avatar } from "@/components/base/avatar/avatar";
import { Button } from "@/components/base/buttons/button";
import { Drawer } from "@/components/base/drawer/drawer";
import { Dropdown, DropdownItem, DropdownPopover, DropdownTrigger } from "@/components/base/dropdown/dropdown";
import { Tab, TabList, TabPanel, Tabs } from "@/components/base/tabs/tabs";
import { ScrollFade, useScrollFade } from "@/components/foundations/scroll-fade/scroll-fade";
import { Textarea } from "@/components/base/textarea/textarea";
import type { PlacedThreads, Thread } from "@/lib/library/comments";
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
  const field = useRef<HTMLTextAreaElement>(null);
  // Explicit, since a menu closing can hand focus back to the page in the same tick.
  useEffect(() => {
    if (!autoFocus) return;
    const id = window.setTimeout(() => field.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [autoFocus]);
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
        ref={field}
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

/** Where a thread points, as the card's first line: "Contacts · RT: Pak Budi…", "Whole page" or "Deleted content · …". */
export interface ThreadLocation {
  section: string;
  quote: string;
}

function LocationLine({ location }: { location: ThreadLocation }) {
  return (
    <span className="flex min-w-0 items-baseline gap-1 text-body-2-medium text-text-tertiary">
      <span className="shrink-0">{location.section}</span>
      {location.quote ? (
        <>
          <span aria-hidden>·</span>
          <span className="truncate font-normal">{location.quote}</span>
        </>
      ) : null}
    </span>
  );
}

/**
 * One thread as a card. Pressing it shows its block in the page; the open
 * card takes the reply box, as in Google Docs.
 */
function ThreadCard({ thread, ctx, location, active, onActivate }: { thread: Thread; ctx: CommentContext; location: ThreadLocation; active: boolean; onActivate: () => void }) {
  const { root } = thread;
  const ref = useRef<HTMLElement>(null);
  // Opened from the page (a count beside a block): bring the card into view.
  useEffect(() => {
    if (active) ref.current?.scrollIntoView({ block: "nearest", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }, [active]);
  return (
    <article
      ref={ref}
      aria-label={`Comment by ${root.author_name || root.created_by}`}
      onClick={(e) => {
        // Presses on the card's own controls stay theirs.
        if (!(e.target as HTMLElement).closest("button, a, textarea, input, [role='menu'], [role='dialog']")) onActivate();
      }}
      className={cx(
        "flex cursor-default flex-col gap-3 rounded-3xl border bg-background-primary-default p-3 transition-colors",
        active ? "border-border-button-hover" : "border-separator-border hover:border-border-button-default",
      )}
    >
      <button
        type="button"
        onClick={onActivate}
        className="-m-1 flex min-w-0 cursor-pointer rounded-md p-1 text-start outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring"
        aria-label={`Show in page: ${location.section}${location.quote ? `, ${location.quote}` : ""}`}
      >
        <LocationLine location={location} />
      </button>
      <CommentItem comment={root} ctx={ctx} isRoot thread={thread} />
      {thread.replies.map((r) => (
        <CommentItem key={r.id} comment={r} ctx={ctx} isRoot={false} thread={thread} />
      ))}
      {root.resolved ? (
        <span className="flex items-center gap-1 text-body-2-medium text-text-tertiary">
          <RiCheckLine className="size-3.5" aria-hidden />
          Marked as resolved
        </span>
      ) : ctx.canEdit ? (
        active ? (
          <Composer label="Reply" placeholder="Reply…" submit="Reply" onSend={(body) => ctx.api.add({ parent_id: root.id, body })} />
        ) : (
          <button
            type="button"
            onClick={onActivate}
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

/** A comment being started: on a block (quoting it) or on the whole page. */
export interface PendingComment {
  blockId: string;
  quote: string;
}

export interface CommentsPanelProps {
  placed: PlacedThreads;
  ctx: CommentContext;
  /** Where each block sits: its order in the page and the heading it falls under. */
  locate: (thread: Thread, orphaned: boolean) => ThreadLocation;
  order: (thread: Thread) => number;
  pending: PendingComment | null;
  setPending: (p: PendingComment | null) => void;
  activeId: string | null;
  onActivate: (thread: Thread) => void;
  onClose: () => void;
}

type View = "all" | "mine";

function PanelBody({ placed, ctx, locate, order, pending, setPending, activeId, onActivate }: Omit<CommentsPanelProps, "onClose">) {
  const [view, setView] = useState<View>("all");
  const fade = useScrollFade();
  const orphans = new Set(placed.orphaned.map((t) => t.root.id));
  const all = [...placed.page, ...[...placed.blocks.values()].flat(), ...placed.orphaned].sort((a, b) => order(a) - order(b) || a.root.created_at.localeCompare(b.root.created_at));
  const mine = (t: Thread) => t.root.created_by === ctx.me || t.replies.some((r) => r.created_by === ctx.me);
  const shown = view === "all" ? all : all.filter(mine);
  const open = shown.filter((t) => !t.root.resolved);
  const resolved = shown.filter((t) => t.root.resolved);
  const card = (t: Thread) => <ThreadCard key={t.root.id} thread={t} ctx={ctx} location={locate(t, orphans.has(t.root.id))} active={t.root.id === activeId} onActivate={() => onActivate(t)} />;

  const list = (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <ScrollFade progress={fade.progress} surfaceClassName="from-background-full" />
      <div onScroll={fade.onScroll} className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain pb-4">
        {pending ? (
          <div className="flex flex-col gap-3 rounded-3xl border border-border-button-hover bg-background-primary-default p-3">
            <LocationLine location={pending.blockId ? { section: "New comment", quote: pending.quote } : { section: "New comment on the whole page", quote: "" }} />
            <Composer
              key={pending.blockId}
              label="New comment"
              placeholder={pending.blockId ? "Add a comment…" : "Comment on this page…"}
              autoFocus
              onCancel={() => setPending(null)}
              onSend={async (body) => {
                const ok = await ctx.api.add({ block_id: pending.blockId, quote: pending.quote, body });
                if (ok) setPending(null);
                return ok;
              }}
            />
          </div>
        ) : ctx.canEdit ? (
          <button
            type="button"
            onClick={() => setPending({ blockId: "", quote: "" })}
            className="flex min-h-9 w-full cursor-pointer items-center gap-2 rounded-xl border border-dashed border-border-button-default px-3 text-start text-body-medium text-text-secondary outline-none transition-colors hover:border-border-button-hover hover:text-text-primary focus-visible:ring-2 focus-visible:ring-border-focus-ring"
          >
            <RiAddLine className="size-4 shrink-0 text-foreground-icon-secondary" aria-hidden />
            Comment on the whole page
          </button>
        ) : null}

        {open.map(card)}
        {!open.length && !pending ? (
          <p className="px-1 py-2 text-body-2-regular text-text-tertiary">
            {view === "mine"
              ? "Threads you start or reply to show up here."
              : resolved.length
                ? "No open comments."
                : ctx.canEdit
                  ? "No comments yet. Select some words, or open a block's ⋮⋮ menu, to comment on it."
                  : "No comments yet."}
          </p>
        ) : null}

        {resolved.length ? (
          <section aria-labelledby="comments-resolved" className="flex flex-col gap-3 pt-3">
            <h3 id="comments-resolved" className="px-1 text-body-semibold text-text-secondary">
              Resolved
            </h3>
            {resolved.map(card)}
          </section>
        ) : null}
      </div>
    </div>
  );

  return (
    <Tabs selectedKey={view} onSelectionChange={(k) => setView(k as View)} className="flex min-h-0 flex-1 flex-col gap-3">
      <TabList aria-label="Which comments">
        <Tab id="all">All comments</Tab>
        <Tab id="mine">For you</Tab>
      </TabList>
      <TabPanel id="all" className="flex min-h-0 flex-1 flex-col outline-none">
        {list}
      </TabPanel>
      <TabPanel id="mine" className="flex min-h-0 flex-1 flex-col outline-none">
        {list}
      </TabPanel>
    </Tabs>
  );
}

function PanelHeader({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <h2 className="text-title-2-semibold text-text-primary">Comments</h2>
      <Button variant="secondary" size="small" iconOnly leadingIcon={RiCloseLine} aria-label="Close comments" onClick={onClose} className="border-transparent bg-transparent" />
    </div>
  );
}

const WIDE = "(min-width: 1280px)";
const subscribeWide = (cb: () => void) => {
  const mq = window.matchMedia(WIDE);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};

/** True from the xl breakpoint, where the panel docks beside the page instead of sliding over it. */
export function useWide() {
  return useSyncExternalStore(subscribeWide, () => window.matchMedia(WIDE).matches, () => true);
}

/**
 * Comments, as in Google Docs: docked on the right beside the page, no
 * overlay, so the page stays readable and editable while you discuss it.
 * Narrower screens get the same panel as a drawer.
 */
export function CommentsPanel(props: CommentsPanelProps & { open: boolean }) {
  const wide = useWide();
  if (wide) {
    if (!props.open) return null;
    return (
      <aside aria-label="Comments" className="sticky top-4 flex h-[calc(100dvh-4rem)] min-h-0 flex-col gap-3 border-s border-separator-border ps-5">
        <PanelHeader onClose={props.onClose} />
        <PanelBody {...props} />
      </aside>
    );
  }
  return (
    <Drawer isOpen={props.open} onOpenChange={(o) => !o && props.onClose()} placement="end" size="md" aria-label="Comments" className="flex h-full flex-col gap-3 rounded-3xl bg-background-full p-4">
      <PanelHeader onClose={props.onClose} />
      <PanelBody {...props} />
    </Drawer>
  );
}
