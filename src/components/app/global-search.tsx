"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { RiArrowLeftRightLine, RiCalendarScheduleLine, RiCheckboxBlankCircleLine, RiCheckboxCircleLine, RiFileTextLine, RiRepeatLine } from "@remixicon/react";
import { searchBook } from "@/actions/search";
import { Kbd } from "@/components/base/kbd/kbd";
import { Modal } from "@/components/base/modal/modal";
import { SearchField } from "@/components/base/search-field/search-field";
import { hasAll, queryWords } from "@/lib/search/book-search";
import { cx } from "@/utils/cx";
import type { ResolvedNav } from "./app-sidebar";
import type { ShellBook } from "./book-switcher";
import { CategoryIcon } from "./category-icon";

const DEBOUNCE_MS = 180;

type Found = NonNullable<Extract<Awaited<ReturnType<typeof searchBook>>, { ok: true }>["data"]>;

interface Row {
  key: string;
  group: string;
  href: string;
  title: string;
  subtitle?: string;
  icon: ReactNode;
  trailing?: string;
}

/** The words of the query marked where they appear (case-insensitive). */
function Highlight({ text, query }: { text: string; query: string }): ReactNode {
  const words = query
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!words.length) return text;
  return text.split(new RegExp(`(${words.join("|")})`, "gi")).map((part, i) =>
    i % 2 ? (
      <mark key={i} className="rounded-sm bg-button-ghost-hover px-px text-text-primary">
        {part}
      </mark>
    ) : (
      part
    ),
  );
}

const glyph = (node: ReactNode) => <span className="flex size-6 shrink-0 items-center justify-center text-body-regular">{node}</span>;
const navIcon = (Icon: ResolvedNav["icon"]) => glyph(<Icon className="size-4 text-foreground-icon-secondary" aria-hidden />);

/** Everything found, in the order shown: where to go first, then pages, money, lists and plans. */
function rowsFor(query: string, nav: ResolvedNav[], found: Found | null, base: string): Row[] {
  const words = queryWords(query);
  const goTo = (words.length ? nav.filter((n) => hasAll(n.label, words)) : nav).map<Row>((n) => ({ key: `nav-${n.href}`, group: "Go to", href: n.href, title: n.label, icon: navIcon(n.icon) }));
  if (!found || !words.length) return goTo;
  return [
    ...goTo,
    ...found.pages.map<Row>((p) => ({
      key: `page-${p.pageId}`,
      group: "Library",
      href: `${base}/library/${p.pageId}${p.blockId ? `?block=${encodeURIComponent(p.blockId)}` : ""}`,
      title: p.title,
      subtitle: p.snippet,
      icon: glyph(p.emoji || <RiFileTextLine className="size-4 text-foreground-icon-tertiary" aria-hidden />),
    })),
    ...found.transactions.map<Row>((t) => ({
      key: `txn-${t.id}`,
      group: "Transactions",
      href: `${base}/transactions?m=${t.period}&q=${encodeURIComponent(t.description)}`,
      title: t.description || t.categoryName || "Transaction",
      subtitle: [new Date(`${t.date}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }), t.categoryName].filter(Boolean).join(" · "),
      trailing: `${t.type === "income" ? "+" : t.type === "expense" ? "−" : ""}${t.amountLabel}`,
      icon: glyph(t.categoryEmoji || <RiArrowLeftRightLine className="size-4 text-foreground-icon-tertiary" aria-hidden />),
    })),
    ...found.categories.map<Row>((c) => ({
      key: `cat-${c.id}`,
      group: "Categories",
      href: `${base}/transactions?category=${encodeURIComponent(c.id)}`,
      title: c.name,
      subtitle: `${c.group} · this period's transactions`,
      icon: <CategoryIcon name={c.name} emoji={c.emoji} color={c.color} group={c.group} size="sm" />,
    })),
    ...found.items.map<Row>((i) => ({
      key: `item-${i.itemId}`,
      group: "Lists",
      href: `${base}/lists?list=${encodeURIComponent(i.listId)}`,
      title: i.title,
      subtitle: `${i.listEmoji ? `${i.listEmoji} ` : ""}${i.listName}${i.done ? " · done" : ""}`,
      icon: glyph(
        i.done ? <RiCheckboxCircleLine className="size-4 text-foreground-icon-tertiary" aria-hidden /> : <RiCheckboxBlankCircleLine className="size-4 text-foreground-icon-secondary" aria-hidden />,
      ),
    })),
    ...found.plans.map<Row>((p) => ({
      key: `${p.kind}-${p.id}`,
      group: p.kind === "recurring" ? "Recurring" : "Installments",
      href: `${base}/${p.kind === "recurring" ? "recurring" : "installments"}`,
      title: p.name,
      icon: navIcon(p.kind === "recurring" ? RiRepeatLine : RiCalendarScheduleLine),
    })),
  ];
}

/**
 * One search for the whole book, from the top of the sidebar (or ⌘K /
 * Ctrl+K anywhere): jump to a page of the app, or find a Library page, a
 * transaction, a category, a list item or a recurring rule. Arrow keys move,
 * Enter opens.
 */
export function GlobalSearch({ open, onOpenChange, current, nav }: { open: boolean; onOpenChange: (open: boolean) => void; current?: ShellBook; nav: ResolvedNav[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<Found | null>(null);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();
  const base = current ? `/b/${current.id}` : "";

  // Search as you type, after a short pause; a newer query wins over a slower answer.
  useEffect(() => {
    if (!current || !query.trim()) return;
    let latest = true;
    const t = window.setTimeout(async () => {
      setLoading(true);
      const res = await searchBook(current.id, { q: query });
      if (!latest) return;
      setLoading(false);
      if (res.ok && res.data) {
        setFound(res.data);
        setActive(0);
      }
    }, DEBOUNCE_MS);
    return () => {
      latest = false;
      window.clearTimeout(t);
    };
  }, [current, query]);

  const rows = rowsFor(query, nav, query.trim() ? found : null, base);
  const close = (next: boolean) => {
    onOpenChange(next);
    if (!next) {
      setQuery("");
      setFound(null);
      setActive(0);
    }
  };
  const go = (row: Row) => {
    close(false);
    router.push(row.href);
  };
  const typing = Boolean(query.trim());
  const groups = [...new Set(rows.map((r) => r.group))];

  return (
    <Modal isOpen={open} onOpenChange={close} size="lg" aria-label="Search" className="flex max-h-[min(40rem,85dvh)] flex-col gap-3 p-4">
      <SearchField
        aria-label="Search everything"
        placeholder={current ? "Search pages, transactions, lists…" : "Go to…"}
        value={query}
        isLoading={loading}
        onChange={(v) => {
          setQuery(v);
          setActive(0);
          if (!v.trim()) setFound(null);
        }}
        autoFocus
        aria-controls={listId}
        aria-activedescendant={rows[active] ? `${listId}-${rows[active].key}` : undefined}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && rows.length) {
            e.preventDefault();
            setActive((a) => (a + 1) % rows.length);
          } else if (e.key === "ArrowUp" && rows.length) {
            e.preventDefault();
            setActive((a) => (a - 1 + rows.length) % rows.length);
          } else if (e.key === "Enter" && rows[active]) {
            e.preventDefault();
            go(rows[active]);
          } else {
            e.continuePropagation();
          }
        }}
      />
      <div id={listId} role="listbox" aria-label="Results" className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
        {groups.map((group) => (
          <div key={group} role="group" aria-label={group} className="flex flex-col gap-0.5">
            <span className="px-2 pb-0.5 text-caption-1-semibold text-text-tertiary">{group}</span>
            {rows
              .filter((r) => r.group === group)
              .map((row) => {
                const i = rows.indexOf(row);
                return (
                  <div
                    key={row.key}
                    id={`${listId}-${row.key}`}
                    role="option"
                    aria-selected={i === active}
                    onMouseMove={() => i !== active && setActive(i)}
                    onClick={() => go(row)}
                    className={cx("flex cursor-pointer items-center gap-3 rounded-xl px-2 py-1.5", i === active && "bg-dropdown-item-hover-background")}
                  >
                    {row.icon}
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-body-medium text-text-primary">
                        <Highlight text={row.title} query={query} />
                      </span>
                      {row.subtitle ? (
                        <span className="line-clamp-1 text-body-2-regular text-text-secondary">
                          <Highlight text={row.subtitle} query={query} />
                        </span>
                      ) : null}
                    </span>
                    {row.trailing ? <span className="shrink-0 text-body-2-medium tabular-nums text-text-secondary">{row.trailing}</span> : null}
                    {i === active ? <Kbd className="shrink-0 max-sm:hidden">↵</Kbd> : null}
                  </div>
                );
              })}
          </div>
        ))}
        {typing && !loading && found && rows.length === 0 ? (
          <p className="px-2 py-8 text-center text-body-regular text-text-tertiary">
            Nothing has all of “{query.trim()}”. Try fewer words.
          </p>
        ) : null}
        {!current && !rows.length ? <p className="px-2 py-8 text-center text-body-regular text-text-tertiary">Open a book to search its records.</p> : null}
      </div>
      <p className="flex items-center gap-1.5 px-2 text-caption-1-medium text-text-tertiary max-sm:hidden">
        <Kbd>↑</Kbd>
        <Kbd>↓</Kbd> to move, <Kbd>↵</Kbd> to open, <Kbd>esc</Kbd> to close
      </p>
    </Modal>
  );
}
