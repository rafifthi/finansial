"use client";

import { useEffect, useState } from "react";
import type { Editor } from "@tiptap/core";
import { getPage, savePage, type BlockConflict } from "@/actions/library";
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
  conflicts: (list: BlockConflict[]) => void;
}

/**
 * Saves one page as it's edited. Only changed blocks are sent; the server
 * keeps every block it wasn't sent, so the other person's edits to other
 * blocks survive, and they're folded into this editor whenever it's idle.
 * Unsaved work is also kept in this browser until the sheet has it.
 */
class PageSaver {
  private editor: Editor | null = null;
  /** What the server has confirmed, in the editor's own form: what edits are measured against. */
  private saved: Map<string, { position: number; json: string }>;
  /** The server's copy as it last came back, to tell when the other person has changed something. */
  private lastServer: Map<string, { position: number; json: string }>;
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
  /** Blocks both people reworded: held back from saving until this person picks a version. */
  private conflicts = new Map<string, BlockConflict>();
  private readonly draftKey: string;

  constructor(
    private readonly bookId: string,
    private readonly pageId: string,
    page: Pick<Page, "title" | "version">,
    rows: PageBlock[],
    private on: SaverEvents,
  ) {
    this.saved = savedMap(rows);
    this.lastServer = savedMap(rows);
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
    this.rebaseline(editor);
    const draft = readDraft(this.draftKey);
    if (!draft) return;
    editor.commands.setContent(draft.doc, { emitUpdate: false });
    this.title = draft.title;
    this.on.title(draft.title);
    if (this.dirty()) this.schedule(IDLE_MS);
    else writeDraft(this.draftKey, null);
  }

  /**
   * The editor fills in default attributes the stored JSON doesn't have
   * (indent: 0, a mention's trigger character), so its copy of an untouched
   * block never matches the sheet's. Count its own first copy as what's
   * saved, or the first edit anywhere would rewrite every block of the page
   * as the editor's work. Rows typed into the sheet by hand (no JSON) stay
   * unmatched, so they're still written properly on the first save.
   */
  private rebaseline(editor: Editor) {
    for (const node of (editor.getJSON() as DocNode).content ?? []) {
      const id = node.attrs?.id;
      const saved = typeof id === "string" ? this.saved.get(id) : undefined;
      if (saved?.json) this.saved.set(id as string, { position: saved.position, json: JSON.stringify(node) });
    }
  }

  /** Leaving the page: save what's left now. */
  detach() {
    window.clearTimeout(this.timer);
    if (this.dirty()) void this.flush();
  }

  /** What to send: every changed block except the ones waiting on a conflict. */
  private changes(editor: Editor) {
    const diff = diffBlocks(this.saved, editor.getJSON() as DocNode);
    return {
      upserts: diff.upserts.filter((u) => !this.conflicts.has(u.id)),
      removes: diff.removes.filter((id) => !this.conflicts.has(id)),
    };
  }

  dirty() {
    if (!this.editor || this.editor.isDestroyed) return false;
    const diff = this.changes(this.editor);
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
    const { upserts, removes } = this.changes(editor);
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
      // Each block goes with how it looked when this editor last saw it, so the server can tell
      // whether someone else reworded it in the meantime.
      res = await savePage(this.bookId, {
        id: this.pageId,
        title,
        upserts: upserts.map((u) => ({ ...u, base: this.lastServer.get(u.id)?.json ?? "" })),
        removes,
        removeBases: Object.fromEntries(removes.map((id) => [id, this.lastServer.get(id)?.json ?? ""])),
      });
    } catch {
      res = { ok: false, error: "You're offline." };
    }
    if (!res.ok || !res.data) {
      const wait = RETRY_MS[Math.min(this.retries++, RETRY_MS.length - 1)];
      this.schedule(wait, "retrying", res.ok ? "Couldn't save." : res.error);
      return;
    }
    this.retries = 0;
    // Blocks the other person reworded meanwhile weren't written: hold them for this person to decide.
    for (const c of res.data.conflicts) this.conflicts.set(c.id, c);
    if (res.data.conflicts.length) this.on.conflicts([...this.conflicts.values()]);
    // Record what we sent as saved, then see what else the server has.
    for (const u of upserts) {
      if (this.conflicts.has(u.id)) continue;
      this.saved.set(u.id, { position: u.position, json: u.json });
      this.lastServer.set(u.id, { position: u.position, json: u.json });
    }
    for (const id of removes) {
      if (this.conflicts.has(id)) continue;
      this.saved.delete(id);
      this.lastServer.delete(id);
    }
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
    const known = this.lastServer;
    const same = fresh.size === known.size && [...fresh].every(([id, b]) => known.get(id)?.json === b.json && known.get(id)?.position === b.position);
    if (same) {
      this.incoming = null;
      return;
    }
    // Not while edits are on their way, or while a conflict waits on a choice (it would be swept away).
    if (this.editsSinceSend || this.dirty() || this.conflicts.size) {
      this.incoming = blocks;
      return;
    }
    replaceDoc(editor, docFromRows(blocks));
    this.saved = fresh;
    this.lastServer = new Map(fresh);
    this.rebaseline(editor);
    this.incoming = null;
  }

  /**
   * Settles a block both people reworded. "mine" writes this person's version
   * over theirs (or deletes it, if that's what they did); "theirs" puts the
   * other person's version back in this editor.
   */
  resolve(id: string, choice: "mine" | "theirs") {
    const editor = this.editor;
    const c = this.conflicts.get(id);
    if (!editor || editor.isDestroyed || !c) return;
    this.conflicts.delete(id);
    // Either way, their version is now the one this editor has seen.
    this.lastServer.set(id, { position: c.theirs.position, json: c.theirs.json });
    if (choice === "theirs") {
      const node = editor.schema.nodeFromJSON(JSON.parse(c.theirs.json));
      const end = editor.state.doc.content.size;
      const spot = { from: -1, to: -1, insertAt: end };
      editor.state.doc.forEach((n, pos) => {
        if (n.attrs.id === id) Object.assign(spot, { from: pos, to: pos + n.nodeSize });
        // A deleted block comes back before the first block that sat after it.
        const p = this.saved.get(String(n.attrs.id))?.position;
        if (p !== undefined && p > c.theirs.position && spot.insertAt === end) spot.insertAt = pos;
      });
      const tr = editor.state.tr;
      if (spot.from >= 0) tr.replaceWith(spot.from, spot.to, node);
      else tr.insert(spot.insertAt, node);
      editor.view.dispatch(tr.setMeta("addToHistory", false));
      const now = (editor.getJSON() as DocNode).content?.find((n) => n.attrs?.id === id);
      if (now) this.saved.set(id, { position: c.theirs.position, json: JSON.stringify(now) });
    }
    this.on.conflicts([...this.conflicts.values()]);
    if (choice === "mine") void this.flush();
    else if (!this.conflicts.size && this.incoming) this.absorb(this.incoming);
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
  const [conflicts, setConflicts] = useState<BlockConflict[]>([]);
  const [saver] = useState(() => new PageSaver(bookId, page.id, page, rows, { status: () => {}, page: () => {}, title: () => {}, conflicts: () => {} }));

  useEffect(() => {
    saver.listen({ status: (s, error) => setStatus({ status: s, error }), page: onPage, title: setTitle, conflicts: setConflicts });
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

  return { ...status, saver, conflicts };
}
