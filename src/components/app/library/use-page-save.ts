"use client";

import { useEffect, useState } from "react";
import type { Editor } from "@tiptap/core";
import { getPage, savePage } from "@/actions/library";
import { diffBlocks, docFromRows, savedMap, type DocNode } from "@/lib/library/blocks";
import type { Page, PageBlock } from "@/lib/sheets/schema";

export type SaveStatus = "saved" | "unsaved" | "saving" | "retrying";

/*
 * Every save is a read and a write per tab touched, on a Sheets quota of about
 * 60 a minute shared by every book. So: save once typing pauses, at most every
 * MAX_WAIT_MS while it doesn't, and right away when the page is left.
 */
const IDLE_MS = 2_500;
const MAX_WAIT_MS = 12_000;
const POLL_MS = 30_000;
const RETRY_MS = [3_000, 10_000, 30_000, 60_000];

interface Draft {
  title: string;
  doc: DocNode;
  at: number;
}

function readDraft(key: string): Draft | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Draft) : null;
  } catch {
    return null;
  }
}

function writeDraft(key: string, draft: Draft | null) {
  try {
    if (draft) window.localStorage.setItem(key, JSON.stringify(draft));
    else window.localStorage.removeItem(key);
  } catch {
    // Private mode or full storage: the server save still runs.
  }
}

/** Keeps the cursor where it was when the document is swapped for a newer one. */
function replaceDoc(editor: Editor, doc: DocNode) {
  const { from, to } = editor.state.selection;
  editor.commands.setContent(doc, { emitUpdate: false });
  const max = editor.state.doc.content.size;
  editor.commands.setTextSelection({ from: Math.min(from, max), to: Math.min(to, max) });
}

interface SaverEvents {
  status: (status: SaveStatus, error: string) => void;
  page: (page: Page) => void;
  title: (title: string) => void;
}

/**
 * Saves one page as it's edited. Only changed blocks are sent; the server
 * keeps every block it wasn't sent, so the other person's edits to other
 * blocks survive, and they're folded into this editor whenever it's idle.
 * Unsaved work is also kept in this browser until the sheet has it.
 */
class PageSaver {
  private editor: Editor | null = null;
  /** What the server has confirmed, as far as this editor knows. */
  private saved: Map<string, { position: number; json: string }>;
  private savedTitle: string;
  private title: string;
  private version: number;
  /** A newer copy from the server, waiting for the editor to be idle. */
  private incoming: PageBlock[] | null = null;
  private inflight: Promise<void> | null = null;
  private timer: number | undefined;
  private firstChange = 0;
  private retries = 0;
  private editsSinceSend = 0;
  private readonly draftKey: string;

  constructor(
    private readonly bookId: string,
    private readonly pageId: string,
    page: Pick<Page, "title" | "version">,
    rows: PageBlock[],
    private on: SaverEvents,
  ) {
    this.saved = savedMap(rows);
    this.savedTitle = this.title = page.title;
    this.version = page.version;
    this.draftKey = `finansial:library-draft:${bookId}:${pageId}`;
  }

  /** Where status, page and restored-title updates go. */
  listen(on: SaverEvents) {
    this.on = on;
  }

  /** Connects the editor once it exists, bringing back work left in this browser last time. */
  attach(editor: Editor) {
    if (this.editor === editor) return;
    this.editor = editor;
    const draft = readDraft(this.draftKey);
    if (!draft) return;
    editor.commands.setContent(draft.doc, { emitUpdate: false });
    this.title = draft.title;
    this.on.title(draft.title);
    if (this.dirty()) this.schedule(IDLE_MS);
    else writeDraft(this.draftKey, null);
  }

  /** Leaving the page: save what's left now. */
  detach() {
    window.clearTimeout(this.timer);
    if (this.dirty()) void this.flush();
  }

  dirty() {
    if (!this.editor || this.editor.isDestroyed) return false;
    const diff = diffBlocks(this.saved, this.editor.getJSON() as DocNode);
    return diff.upserts.length > 0 || diff.removes.length > 0 || this.title !== this.savedTitle;
  }

  /** Call after every edit, with the new title when that's what changed. */
  changed(title?: string) {
    if (title !== undefined) this.title = title;
    if (!this.editor) return;
    this.editsSinceSend++;
    writeDraft(this.draftKey, { title: this.title, doc: this.editor.getJSON() as DocNode, at: Date.now() });
    const now = Date.now();
    this.firstChange ||= now;
    this.schedule(Math.max(0, Math.min(IDLE_MS, this.firstChange + MAX_WAIT_MS - now)));
  }

  private schedule(ms: number, status: SaveStatus = "unsaved", error = "") {
    window.clearTimeout(this.timer);
    this.on.status(status, error);
    this.timer = window.setTimeout(() => void this.flush(), ms);
  }

  async flush(): Promise<void> {
    window.clearTimeout(this.timer);
    const editor = this.editor;
    if (!editor || editor.isDestroyed) return;
    if (this.inflight) {
      await this.inflight;
      if (this.dirty()) return this.flush();
      return;
    }
    const { upserts, removes } = diffBlocks(this.saved, editor.getJSON() as DocNode);
    const title = this.title;
    const retitled = title !== this.savedTitle;
    if (!upserts.length && !removes.length && !retitled) {
      this.on.status("saved", "");
      writeDraft(this.draftKey, null);
      if (this.incoming) this.absorb(this.incoming);
      return;
    }
    this.on.status("saving", "");
    this.editsSinceSend = 0;
    this.firstChange = 0;
    this.inflight = this.send(upserts, removes, retitled ? title : undefined).finally(() => (this.inflight = null));
    return this.inflight;
  }

  private async send(upserts: Parameters<typeof savePage>[1]["upserts"], removes: string[], title: string | undefined) {
    let res: Awaited<ReturnType<typeof savePage>>;
    try {
      res = await savePage(this.bookId, { id: this.pageId, title, upserts, removes });
    } catch {
      res = { ok: false, error: "You're offline." };
    }
    if (!res.ok || !res.data) {
      const wait = RETRY_MS[Math.min(this.retries++, RETRY_MS.length - 1)];
      this.schedule(wait, "retrying", res.ok ? "Couldn't save." : res.error);
      return;
    }
    this.retries = 0;
    // Record what we sent as saved, then see what else the server has.
    for (const u of upserts) this.saved.set(u.id, { position: u.position, json: u.json });
    for (const id of removes) this.saved.delete(id);
    if (title !== undefined) this.savedTitle = title;
    this.version = res.data.page.version;
    this.on.page(res.data.page);
    this.absorb(res.data.blocks);
    if (this.dirty()) this.schedule(IDLE_MS);
    else {
      this.on.status("saved", "");
      writeDraft(this.draftKey, null);
    }
  }

  /** Takes in the server's copy, unless something here is waiting to be saved. */
  private absorb(blocks: PageBlock[]) {
    const editor = this.editor;
    if (!editor || editor.isDestroyed) return;
    const fresh = savedMap(blocks);
    const same = fresh.size === this.saved.size && [...fresh].every(([id, b]) => this.saved.get(id)?.json === b.json && this.saved.get(id)?.position === b.position);
    if (same) {
      this.incoming = null;
      return;
    }
    if (this.editsSinceSend || this.dirty()) {
      this.incoming = blocks;
      return;
    }
    replaceDoc(editor, docFromRows(blocks));
    this.saved = fresh;
    this.incoming = null;
  }

  /** Picks up the other person's saves while this page is open and idle. */
  async poll() {
    if (document.visibilityState !== "visible" || this.inflight || this.dirty()) return;
    const res = await getPage(this.bookId, { id: this.pageId });
    if (!res.ok || !res.data || res.data.page.version <= this.version || this.inflight || this.dirty()) return;
    this.version = res.data.page.version;
    this.on.page(res.data.page);
    this.absorb(res.data.blocks);
  }
}

export function usePageSave({
  bookId,
  page,
  rows,
  setTitle,
  onPage,
}: {
  bookId: string;
  page: Pick<Page, "id" | "title" | "version">;
  rows: PageBlock[];
  /** Called with the title of work restored from this browser. */
  setTitle: (title: string) => void;
  onPage: (page: Page) => void;
}) {
  const [status, setStatus] = useState<{ status: SaveStatus; error: string }>({ status: "saved", error: "" });
  const [saver] = useState(() => new PageSaver(bookId, page.id, page, rows, { status: () => {}, page: () => {}, title: () => {} }));

  useEffect(() => {
    saver.listen({ status: (s, error) => setStatus({ status: s, error }), page: onPage, title: setTitle });
  }, [saver, onPage, setTitle]);

  // Leaving the page or the tab saves now; closing with unsaved work asks first.
  useEffect(() => {
    const onHide = () => document.visibilityState === "hidden" && saver.dirty() && void saver.flush();
    const onUnload = (e: BeforeUnloadEvent) => {
      if (!saver.dirty()) return;
      void saver.flush();
      e.preventDefault();
    };
    const poll = window.setInterval(() => void saver.poll(), POLL_MS);
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("beforeunload", onUnload);
    return () => {
      window.clearInterval(poll);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("beforeunload", onUnload);
      saver.detach();
    };
  }, [saver]);

  return { ...status, saver };
}
