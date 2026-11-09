"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { Placeholder } from "@tiptap/extensions";
import UniqueID from "@tiptap/extension-unique-id";
import { TableKit } from "@tiptap/extension-table";
import { RiArrowLeftSLine, RiChat3Line, RiCheckLine, RiCloudOffLine, RiLoader4Line, RiPencilLine } from "@remixicon/react";
import { InputBase, TextField } from "@/components/base/input/input";
import { docFromRows } from "@/lib/library/blocks";
import { buildThreads, openCounts, placeThreads, quoteOf, type Thread } from "@/lib/library/comments";
import { ancestors, pageTitle } from "@/lib/library/tree";
import type { Page, PageBlock, PageComment } from "@/lib/sheets/schema";
import { cx } from "@/utils/cx";
import { useBookId } from "../permissions";
import { CommentsPanel, type CommentContext, type PendingComment, type ThreadLocation } from "./comments";
import { CommentMarkers, CommentMarks, setCommentMarks } from "./editor/comment-marks";
import { EditorBubble } from "./editor/editor-bubble";
import { LinkShortcut } from "./editor/link";
import { BlockHandle } from "./editor/block-handle";
import { DateChip } from "./editor/date-chip";
import { peopleMentions } from "./editor/mention";
import { TableMenu } from "./editor/table-menu";
import { Indent } from "./editor/indent";
import { SlashMenu } from "./editor/slash-menu";
import { TocMenu, TocRail, useActiveHeading, useToc } from "./editor/toc";
import { useLibrary } from "./library-context";
import { PageMenu } from "./page-tree";
import { useComments } from "./use-comments";
import { usePageSave, type SaveStatus } from "./use-page-save";

/** Nodes that get a stable id: every top-level block (one sheet row each) and list items, for comments to point at later. */
const ID_TYPES = ["paragraph", "heading", "bulletList", "orderedList", "taskList", "listItem", "taskItem", "blockquote", "codeBlock", "horizontalRule", "table"];

const BARE = "min-h-0 bg-transparent px-0 py-0 shadow-none ring-0 max-sm:min-h-0";

const STATUS: Record<SaveStatus, { label: string; icon: typeof RiCheckLine; spin?: boolean }> = {
  saved: { label: "Saved", icon: RiCheckLine },
  unsaved: { label: "Editing", icon: RiPencilLine },
  saving: { label: "Saving…", icon: RiLoader4Line, spin: true },
  retrying: { label: "Not saved yet · kept on this device", icon: RiCloudOffLine },
};

function SaveState({ status, error }: { status: SaveStatus; error: string }) {
  const s = STATUS[status];
  return (
    <span role="status" title={status === "retrying" ? error : undefined} className={cx("flex items-center gap-1 text-body-2-regular", status === "retrying" ? "text-text-error-primary" : "text-text-tertiary")}>
      <s.icon className={cx("size-3.5 shrink-0", s.spin && "animate-spin motion-reduce:animate-none")} aria-hidden />
      {s.label}
    </span>
  );
}

function edited(page: Pick<Page, "updated_at">) {
  if (!page.updated_at) return "";
  const d = new Date(page.updated_at);
  if (Number.isNaN(d.getTime())) return "";
  return `Edited ${d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}, ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
}

/** One Library page: breadcrumbs, title, then the document, saved as it's typed. */
export function PageEditor({ page: initialPage, rows, comments }: { page: Page; rows: PageBlock[]; comments: PageComment[] }) {
  const bookId = useBookId();
  const { pages, canEdit, href, patchLocal, user, userName, userId, members } = useLibrary();
  const [title, setTitle] = useState(initialPage.title);
  const [meta, setMeta] = useState(initialPage);
  // ⌘K in the editor tells the link popover to open.
  const [linkEvents] = useState(() => new EventTarget());

  const onPage = useCallback(
    (p: Page) => {
      setMeta(p);
      patchLocal(p.id, { version: p.version, updated_at: p.updated_at, updated_by: p.updated_by });
    },
    [patchLocal],
  );
  // Before the editor, so the saver is listening by the time the editor attaches.
  const save = usePageSave({ bookId, page: initialPage, rows, setTitle, onPage });
  const { saver } = save;

  const extensions = useMemo(
    () => [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        // Passwords, commands and addresses aren't words to spell-check.
        code: { HTMLAttributes: { spellcheck: "false" } },
        codeBlock: { HTMLAttributes: { spellcheck: "false" } },
        link: {
          openOnClick: !canEdit,
          autolink: true,
          linkOnPaste: true,
          defaultProtocol: "https",
          HTMLAttributes: { target: "_blank", rel: "noopener noreferrer" },
        },
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({
        placeholder: ({ node }) => (node.type.name === "heading" ? "Heading" : canEdit ? "Type / for blocks" : ""),
        showOnlyCurrent: true,
      }),
      TableKit.configure({ table: { resizable: canEdit, cellMinWidth: 96 } }),
      DateChip,
      peopleMentions(members, userId),
      UniqueID.configure({ types: ID_TYPES }),
      Indent,
      CommentMarks,
      ...(canEdit ? [SlashMenu, LinkShortcut.configure({ open: () => linkEvents.dispatchEvent(new Event("open")) })] : []),
    ],
    [canEdit, linkEvents, members, userId],
  );

  const editor = useEditor({
    extensions,
    content: docFromRows(rows),
    editable: canEdit,
    immediatelyRender: false,
    editorProps: { attributes: { class: "library-prose min-h-40 pb-6", "aria-label": "Page content" } },
    // Id fills from the UniqueID extension aren't edits.
    onUpdate: ({ transaction }) => transaction.getMeta("addToHistory") !== false && saver.changed(),
  });

  useEffect(() => {
    if (editor) saver.attach(editor);
  }, [editor, saver]);

  // The tab's title follows the page's as it's renamed.
  useEffect(() => {
    document.title = `${pageTitle({ title })} · Finansial`;
  }, [title]);

  const toc = useToc(editor);
  const [activeHeading, pickHeading] = useActiveHeading(toc);
  // A contents list earns its place once a page has a few sections.
  const showToc = toc.length >= 2;

  // Comments: threads placed on the blocks the page has now; a deleted block's threads join the page's.
  const api = useComments(bookId, initialPage.id, comments, { email: user, name: userName });
  // Every block with an id, in page order, with the heading it sits under: for placing and labelling threads.
  const outline = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      const rows: [string, string][] = [];
      let section = "";
      e?.state.doc.forEach((top) => {
        if (top.type.name === "heading") section = top.textContent.trim();
        if (typeof top.attrs.id === "string") rows.push([top.attrs.id, section]);
        top.descendants((n) => void (typeof n.attrs.id === "string" && rows.push([n.attrs.id, section])));
      });
      return JSON.stringify(rows);
    },
  });
  const where = useMemo(() => new Map((JSON.parse(outline ?? "[]") as [string, string][]).map(([id, section], i) => [id, { index: i, section }])), [outline]);
  const placed = useMemo(() => {
    const threads = buildThreads(api.comments);
    // Until the editor is up, the page's blocks aren't known: don't call any thread's block deleted yet.
    const ids = editor ? new Set(where.keys()) : new Set(threads.map((t) => t.root.block_id));
    return placeThreads(threads, ids);
  }, [api.comments, where, editor]);
  const counts = useMemo(() => openCounts(placed.blocks), [placed]);

  const [panelOpen, setPanelOpen] = useState(false);
  const [pending, setPending] = useState<PendingComment | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const ctx: CommentContext = { api, me: user, canEdit };
  const pageName = pageTitle({ title });

  const locate = useCallback(
    (t: Thread, orphaned: boolean): ThreadLocation => {
      if (!t.root.block_id) return { section: "Whole page", quote: "" };
      if (orphaned) return { section: "Deleted content", quote: t.root.quote };
      return { section: where.get(t.root.block_id)?.section || pageName, quote: t.root.quote };
    },
    // Page-level threads sort first, then by where their block sits; deleted blocks' threads last.
    [where, pageName],
  );
  const order = useCallback((t: Thread) => (!t.root.block_id ? -1 : (where.get(t.root.block_id)?.index ?? Number.MAX_SAFE_INTEGER)), [where]);

  const scrollToBlock = useCallback(
    (id: string) => {
      const el = editor?.view.dom.querySelector(`[data-id="${CSS.escape(id)}"]`);
      el?.scrollIntoView({ block: "center", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    },
    [editor],
  );
  // From a block's menu or selected words: start a new thread on it.
  const startComment = useCallback((id: string, text: string) => {
    setPending({ blockId: id, quote: quoteOf(text) });
    setActiveId(null);
    setPanelOpen(true);
  }, []);
  // From the count beside a block: open its first open thread.
  const openFromMarker = useCallback(
    (id: string) => {
      const first = placed.blocks.get(id)?.find((t) => !t.root.resolved);
      setPending(null);
      setActiveId(first?.root.id ?? null);
      setPanelOpen(true);
    },
    [placed],
  );
  const activate = useCallback(
    (t: Thread) => {
      setActiveId(t.root.id);
      if (t.root.block_id) scrollToBlock(t.root.block_id);
    },
    [scrollToBlock],
  );
  const openCount = [...counts.values()].reduce((a, b) => a + b, 0) + [...placed.page, ...placed.orphaned].filter((t) => !t.root.resolved).length;

  // The block being discussed is tinted in the page.
  const activeBlock = !panelOpen ? null : (pending?.blockId || api.comments.find((c) => c.id === activeId)?.block_id || null);
  useEffect(() => {
    if (editor) setCommentMarks(editor, new Set(counts.keys()), activeBlock);
  }, [editor, counts, activeBlock]);

  // The contents rail and the comments panel share the right-hand column; comments win while open.
  const railShown = showToc && !panelOpen;

  const trail = ancestors(pages, initialPage.id);
  const parent = trail[trail.length - 1];
  const live = pages.find((p) => p.id === initialPage.id);

  return (
    // The contents rail appears whenever the page area has room for it (a container query, not the window size),
    // so it shows beside the page from a 1024px window up.
    <div className="@container">
    <div
      className={cx(
        "mx-auto grid w-full items-start gap-8 lg:ps-12 xl:gap-12",
        panelOpen
          ? "max-w-3xl lg:max-w-none lg:grid-cols-[minmax(0,48rem)_17rem] lg:justify-center xl:grid-cols-[minmax(0,48rem)_minmax(18rem,22rem)]"
          : railShown
            ? "max-w-3xl @min-[680px]:max-w-[calc(48rem+11rem+2rem)] @min-[680px]:grid-cols-[minmax(0,48rem)_11rem] @min-[1000px]:max-w-[calc(48rem+13rem+3rem)] @min-[1000px]:grid-cols-[minmax(0,48rem)_13rem]"
            : "max-w-3xl",
      )}
    >
      <article className="flex min-w-0 flex-col gap-4 lg:pt-2">
        <div className="flex min-h-7 items-center justify-between gap-3">
          <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1 text-body-2-regular text-text-tertiary">
            <Link href={parent ? href(parent.id) : href()} className="flex items-center gap-0.5 rounded-md outline-none hover:text-text-secondary focus-visible:ring-2 focus-visible:ring-border-focus-ring lg:hidden">
              <RiArrowLeftSLine className="size-4 shrink-0 rtl:-scale-x-100" aria-hidden />
              <span className="truncate">{parent ? pageTitle(parent) : "Library"}</span>
            </Link>
            <ol className="flex min-w-0 items-center gap-1 max-lg:hidden">
              <li>
                <Link href={href()} className="rounded-md outline-none hover:text-text-secondary focus-visible:ring-2 focus-visible:ring-border-focus-ring">
                  Library
                </Link>
              </li>
              {trail.map((p) => (
                <li key={p.id} className="flex min-w-0 items-center gap-1">
                  <span aria-hidden>/</span>
                  <Link href={href(p.id)} className="truncate rounded-md outline-none hover:text-text-secondary focus-visible:ring-2 focus-visible:ring-border-focus-ring">
                    {pageTitle(p)}
                  </Link>
                </li>
              ))}
            </ol>
          </nav>
          <div className="flex shrink-0 items-center gap-3">
            {showToc ? (
              <span className={cx(railShown && "@min-[680px]:hidden")}>
                <TocMenu items={toc} active={activeHeading} onPick={pickHeading} />
              </span>
            ) : null}
            <button
              type="button"
              aria-pressed={panelOpen}
              aria-label={openCount ? `Comments, ${openCount} open` : "Comments"}
              onClick={() => {
                setPanelOpen((o) => !o);
                setPending(null);
              }}
              className={cx(
                "flex h-7 cursor-pointer items-center gap-1 rounded-lg px-2 text-body-2-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-border-focus-ring max-sm:h-11",
                panelOpen ? "bg-background-secondary-hover text-text-primary" : "text-text-secondary hover:bg-background-secondary-hover",
              )}
            >
              <RiChat3Line className="size-4 shrink-0 text-foreground-icon-secondary" aria-hidden />
              {openCount ? <span className="tabular-nums">{openCount}</span> : <span className="max-sm:sr-only">Comments</span>}
            </button>
            {canEdit ? <SaveState status={save.status} error={save.error} /> : null}
            {canEdit && live ? <PageMenu page={live} /> : null}
          </div>
        </div>

        <header className="flex flex-col gap-1">
          {canEdit ? (
            <TextField
              aria-label="Title"
              value={title}
              maxLength={200}
              onChange={(t) => {
                setTitle(t);
                patchLocal(initialPage.id, { title: t });
                saver.changed(t);
              }}
              onKeyDown={(e) => {
                // Enter moves on to the first line of the page.
                if ((e.key === "Enter" || (e.key === "ArrowDown" && !e.shiftKey)) && editor) {
                  e.preventDefault();
                  // Focus now, not on the next frame (Tiptap's focus waits for one), so fast typing lands in the page.
                  editor.view.dom.focus();
                  editor.commands.focus("start");
                }
              }}
              fieldClassName={BARE}
            >
              <InputBase placeholder="Untitled" autoComplete="off" autoFocus={initialPage.version === 0 && !initialPage.title} className="field-display px-0 text-large-title-semibold" />
            </TextField>
          ) : (
            <h1 className="text-large-title-semibold text-text-primary">{pageTitle({ title })}</h1>
          )}
          {edited(meta) ? <p className="text-body-2-regular text-text-tertiary">{edited(meta)}</p> : null}
        </header>

        {/* The left gutter holds each block's + and drag handle, and counts as hovering that block. */}
        <div data-block-area className="lg:-ms-14 lg:ps-14">
          {/* Room on the right for comment counts where the page has no margin to put them in. */}
          <EditorContent editor={editor} className={cx("relative", counts.size > 0 && "max-xl:pe-8")} />
        </div>
        {editor && canEdit ? <BlockHandle editor={editor} onComment={startComment} /> : null}
        {editor ? <CommentMarkers editor={editor} counts={counts} onOpen={openFromMarker} /> : null}
        {editor && canEdit ? <EditorBubble editor={editor} linkEvents={linkEvents} onComment={startComment} /> : null}
        {editor && canEdit ? <TableMenu editor={editor} /> : null}
      </article>
      {railShown ? (
        <aside className="sticky top-6 hidden max-h-[calc(100dvh-3rem)] overflow-y-auto pt-14 @min-[680px]:block">
          <TocRail items={toc} active={activeHeading} onPick={pickHeading} />
        </aside>
      ) : null}
      <CommentsPanel
        open={panelOpen}
        onClose={() => {
          setPanelOpen(false);
          setPending(null);
        }}
        placed={placed}
        ctx={ctx}
        locate={locate}
        order={order}
        pending={pending}
        setPending={setPending}
        activeId={activeId}
        onActivate={activate}
      />
    </div>
    </div>
  );
}
