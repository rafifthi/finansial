"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { archivePage, createPage, restorePages, syncLibrary } from "@/actions/library";
import { toast } from "@/components/base/toast/toast";
import { nextPosition, withDescendants } from "@/lib/library/tree";
import type { Page } from "@/lib/sheets/schema";
import { newClientId } from "../lists/use-lists";
import { useBookId } from "../permissions";
import { undoToast } from "../undo";

const POLL_MS = 30_000;

interface LibraryValue {
  pages: Page[];
  canEdit: boolean;
  user: string;
  href: (pageId?: string) => string;
  /** Adds a page (under `parentId`) and opens it. */
  create: (parentId?: string) => void;
  /** Moves a page and its children to the trash, with Undo. */
  archive: (page: Page) => void;
  /** Shows a page's new title or version in the tree before the server has it. */
  patchLocal: (id: string, patch: Partial<Page>) => void;
}

const LibraryContext = createContext<LibraryValue | null>(null);

export function useLibrary(): LibraryValue {
  const v = useContext(LibraryContext);
  if (!v) throw new Error("useLibrary() used outside the Library.");
  return v;
}

/**
 * The Library's page list lives in the browser so the tree reacts at once:
 * new pages, renames and archiving show before the sheet has them. The other
 * person's changes arrive by polling.
 */
export function LibraryProvider({ initial, canEdit, user, children }: { initial: Page[]; canEdit: boolean; user: string; children: ReactNode }) {
  const bookId = useBookId();
  const router = useRouter();
  const [pages, setPages] = useState(initial);
  const pending = useRef(0);
  const local = useRef(new Map<string, Partial<Page>>());

  const href = useCallback((pageId?: string) => `/b/${bookId}/library${pageId ? `/${pageId}` : ""}`, [bookId]);

  const sync = useCallback(async () => {
    if (pending.current) return;
    const res = await syncLibrary(bookId, {});
    if (!res.ok || !res.data || pending.current) return;
    // Titles typed here but not saved yet win over the sheet's.
    setPages(res.data.pages.map((p) => ({ ...p, ...local.current.get(p.id) })));
  }, [bookId]);

  useEffect(() => {
    const id = window.setInterval(() => document.visibilityState === "visible" && void sync(), POLL_MS);
    const onVisible = () => document.visibilityState === "visible" && void sync();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [sync]);

  const patchLocal = useCallback((id: string, patch: Partial<Page>) => {
    if ("title" in patch) local.current.set(id, { ...local.current.get(id), ...patch });
    setPages((all) => all.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }, []);

  const create = useCallback(
    (parentId = "") => {
      const id = newClientId();
      const now = new Date().toISOString();
      setPages((all) => [
        ...all,
        { id, parent_id: parentId, title: "", emoji: "", position: nextPosition(all, parentId), version: 0, archived: false, created_at: now, created_by: user, updated_at: now, updated_by: user },
      ]);
      pending.current++;
      router.push(href(id));
      void createPage(bookId, { id, parent_id: parentId })
        .then((res) => {
          if (!res.ok) {
            setPages((all) => all.filter((p) => p.id !== id));
            toast(res.error, { status: "error" });
            router.push(href());
          }
        })
        .finally(() => pending.current--);
    },
    [bookId, href, router, user],
  );

  const archive = useCallback(
    (page: Page) => {
      pending.current++;
      setPages((all) => {
        const ids = new Set(withDescendants(all, page.id));
        return all.map((p) => (ids.has(p.id) ? { ...p, archived: true } : p));
      });
      if (window.location.pathname.startsWith(href(page.id))) router.push(href(page.parent_id || undefined));
      void archivePage(bookId, { id: page.id })
        .then((res) => {
          if (!res.ok || !res.data) {
            toast(res.ok ? "Couldn't move the page to the trash." : res.error, { status: "error" });
            void sync();
            return;
          }
          const ids = res.data.ids;
          undoToast(`Moved “${page.title.trim() || "Untitled"}” to the trash`, async () => {
            setPages((all) => all.map((p) => (ids.includes(p.id) ? { ...p, archived: false } : p)));
            const undone = await restorePages(bookId, { ids });
            if (!undone.ok) void sync();
            return undone;
          });
        })
        .finally(() => pending.current--);
    },
    [bookId, href, router, sync],
  );

  const value = useMemo(() => ({ pages, canEdit, user, href, create, archive, patchLocal }), [pages, canEdit, user, href, create, archive, patchLocal]);
  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
}
