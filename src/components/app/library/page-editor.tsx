"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { Placeholder } from "@tiptap/extensions";
import UniqueID from "@tiptap/extension-unique-id";
import { RiArrowLeftSLine, RiCheckLine, RiCloudOffLine, RiLoader4Line, RiPencilLine } from "@remixicon/react";
import { InputBase, TextField } from "@/components/base/input/input";
import { docFromRows } from "@/lib/library/blocks";
import { ancestors, pageTitle } from "@/lib/library/tree";
import type { Page, PageBlock } from "@/lib/sheets/schema";
import { cx } from "@/utils/cx";
import { useBookId } from "../permissions";
import { EditorBubble } from "./editor/editor-bubble";
import { LinkShortcut } from "./editor/link";
import { BlockHandle } from "./editor/block-handle";
import { Indent } from "./editor/indent";
import { SlashMenu } from "./editor/slash-menu";
import { TocMenu, TocRail, useActiveHeading, useToc } from "./editor/toc";
import { useLibrary } from "./library-context";
import { PageMenu } from "./page-tree";
import { usePageSave, type SaveStatus } from "./use-page-save";

/** Nodes that get a stable id: every top-level block (one sheet row each) and list items, for comments to point at later. */
const ID_TYPES = ["paragraph", "heading", "bulletList", "orderedList", "taskList", "listItem", "taskItem", "blockquote", "codeBlock", "horizontalRule"];

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
export function PageEditor({ page: initialPage, rows }: { page: Page; rows: PageBlock[] }) {
  const bookId = useBookId();
  const { pages, canEdit, href, patchLocal } = useLibrary();
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
      UniqueID.configure({ types: ID_TYPES }),
      Indent,
      ...(canEdit ? [SlashMenu, LinkShortcut.configure({ open: () => linkEvents.dispatchEvent(new Event("open")) })] : []),
    ],
    [canEdit, linkEvents],
  );

  const editor = useEditor({
    extensions,
    content: docFromRows(rows),
    editable: canEdit,
    immediatelyRender: false,
    editorProps: { attributes: { class: "library-prose min-h-60 pb-24", "aria-label": "Page content" } },
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
  const activeHeading = useActiveHeading(toc);
  // A contents list earns its place once a page has a few sections.
  const showToc = toc.length >= 2;

  const trail = ancestors(pages, initialPage.id);
  const parent = trail[trail.length - 1];
  const live = pages.find((p) => p.id === initialPage.id);

  return (
    <div className={cx("mx-auto grid w-full items-start gap-8 lg:ps-12", showToc ? "max-w-3xl min-[1360px]:max-w-[calc(48rem+11rem+2rem)] min-[1360px]:grid-cols-[minmax(0,48rem)_11rem]" : "max-w-3xl")}>
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
              <span className="min-[1360px]:hidden">
                <TocMenu items={toc} active={activeHeading} />
              </span>
            ) : null}
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
          <EditorContent editor={editor} className="relative" />
        </div>
        {editor && canEdit ? <BlockHandle editor={editor} /> : null}
        {editor && canEdit ? <EditorBubble editor={editor} linkEvents={linkEvents} /> : null}
      </article>
      {showToc ? (
        <aside className="sticky top-6 max-h-[calc(100dvh-3rem)] overflow-y-auto pt-12 max-[1359px]:hidden">
          <TocRail items={toc} active={activeHeading} />
        </aside>
      ) : null}
    </div>
  );
}
