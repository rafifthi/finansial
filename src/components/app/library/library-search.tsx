"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { RiFileTextLine } from "@remixicon/react";
import { searchLibrary } from "@/actions/library";
import { Kbd } from "@/components/base/kbd/kbd";
import { Modal } from "@/components/base/modal/modal";
import { SearchField } from "@/components/base/search-field/search-field";
import type { SearchHit } from "@/lib/library/search";
import { cx } from "@/utils/cx";
import { useBookId } from "../permissions";
import { useLibrary } from "./library-context";

const DEBOUNCE_MS = 180;

/** The words of the query marked where they appear (case-insensitive). */
function Highlight({ text, query }: { text: string; query: string }): ReactNode {
  const words = query
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!words.length) return text;
  const parts = text.split(new RegExp(`(${words.join("|")})`, "gi"));
  return parts.map((part, i) =>
    i % 2 ? (
      <mark key={i} className="rounded-sm bg-button-ghost-hover px-px text-text-primary">
        {part}
      </mark>
    ) : (
      part
    ),
  );
}

/**
 * Search every page's title and words. Results come as you type; arrow keys
 * move, Enter opens the page at the block that matched.
 */
export function LibrarySearch() {
  const bookId = useBookId();
  const router = useRouter();
  const { searchOpen, setSearchOpen, pages, href } = useLibrary();
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [active, setActive] = useState(0);
  const listId = useId();

  // Search as you type, after a short pause; a newer query wins over a slower answer.
  useEffect(() => {
    if (!query.trim()) return;
    let current = true;
    const t = window.setTimeout(async () => {
      const res = await searchLibrary(bookId, { q: query });
      if (current && res.ok && res.data) {
        setHits(res.data);
        setActive(0);
      }
    }, DEBOUNCE_MS);
    return () => {
      current = false;
      window.clearTimeout(t);
    };
  }, [bookId, query]);

  // Before typing: the pages edited most recently, as quick jumps.
  const recent: SearchHit[] = pages
    .filter((p) => !p.archived)
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    .slice(0, 6)
    .map((p) => ({ pageId: p.id, title: p.title.trim() || "Untitled", emoji: p.emoji, snippet: "" }));
  const typing = Boolean(query.trim());
  const shown = typing ? (hits ?? []) : recent;

  const close = (open: boolean) => {
    setSearchOpen(open);
    if (!open) {
      setQuery("");
      setHits(null);
    }
  };
  const go = (hit: SearchHit) => {
    close(false);
    router.push(`${href(hit.pageId)}${hit.blockId ? `?block=${encodeURIComponent(hit.blockId)}` : ""}`);
  };

  return (
    <Modal isOpen={searchOpen} onOpenChange={close} size="lg" aria-label="Search the Library" className="flex max-h-[min(36rem,80dvh)] flex-col gap-3 p-4">
      <SearchField
        aria-label="Search pages"
        placeholder="Search pages and what they say…"
        value={query}
        onChange={(v) => {
          setQuery(v);
          if (!v.trim()) setHits(null);
        }}
        autoFocus
        aria-controls={listId}
        aria-activedescendant={shown[active] ? `${listId}-${active}` : undefined}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && shown.length) {
            e.preventDefault();
            setActive((a) => (a + 1) % shown.length);
          } else if (e.key === "ArrowUp" && shown.length) {
            e.preventDefault();
            setActive((a) => (a - 1 + shown.length) % shown.length);
          } else if (e.key === "Enter" && shown[active]) {
            e.preventDefault();
            go(shown[active]);
          } else {
            e.continuePropagation();
          }
        }}
      />
      <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
        <span className="px-2 text-caption-1-semibold text-text-tertiary">{typing ? (hits === null ? "Searching…" : `${hits.length} ${hits.length === 1 ? "page" : "pages"}`) : "Recently edited"}</span>
        {typing && hits !== null && !hits.length ? (
          <p className="px-2 py-6 text-center text-body-regular text-text-tertiary">No page has all of “{query.trim()}”. Try fewer words.</p>
        ) : (
          <ul id={listId} role="listbox" aria-label="Pages" className="flex flex-col gap-0.5">
            {shown.map((hit, i) => (
              <li
                key={hit.pageId}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseMove={() => i !== active && setActive(i)}
                onClick={() => go(hit)}
                className={cx("flex cursor-pointer items-start gap-3 rounded-xl px-2 py-2", i === active && "bg-dropdown-item-hover-background")}
              >
                <span className="flex size-6 shrink-0 items-center justify-center text-body-regular" aria-hidden>
                  {hit.emoji || <RiFileTextLine className="size-4 text-foreground-icon-tertiary" />}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-body-medium text-text-primary">
                    <Highlight text={hit.title} query={query} />
                  </span>
                  {hit.snippet ? (
                    <span className="line-clamp-2 text-body-2-regular text-text-secondary">
                      <Highlight text={hit.snippet} query={query} />
                    </span>
                  ) : null}
                </span>
                {i === active ? <Kbd className="mt-0.5 shrink-0 max-sm:hidden">↵</Kbd> : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}
