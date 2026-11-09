"use client";

import { useEffect, useState } from "react";
import type { Editor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";
import { RiListUnordered } from "@remixicon/react";
import { Dropdown, DropdownItem, DropdownPopover, DropdownTrigger } from "@/components/base/dropdown/dropdown";
import { cx } from "@/utils/cx";

export interface TocItem {
  id: string;
  level: number;
  text: string;
}

/** The page's headings, in order, from the editor (each has a stable id from UniqueID). */
export function useToc(editor: Editor | null): TocItem[] {
  return (
    useEditorState({
      editor,
      selector: ({ editor: e }) => {
        if (!e) return [];
        const out: TocItem[] = [];
        e.state.doc.forEach((node) => {
          const id = node.attrs.id as string | undefined;
          if (node.type.name === "heading" && id && node.textContent.trim()) out.push({ id, level: node.attrs.level as number, text: node.textContent.trim() });
        });
        return out;
      },
      // Typing in a paragraph changes nothing here; only re-render when the headings do.
      equalityFn: (a, b) => JSON.stringify(a) === JSON.stringify(b),
    }) ?? []
  );
}

const headingEl = (id: string) => document.querySelector<HTMLElement>(`.library-prose [data-id="${CSS.escape(id)}"]`);

/** Space kept above a heading when jumping to it, and how far down the screen counts as "reading it". */
const READ_LINE = 120;

/** The heading being read: the last one that has scrolled past the top part of the screen. */
export function useActiveHeading(items: TocItem[]): string | undefined {
  const [active, setActive] = useState<string>();
  useEffect(() => {
    if (!items.length) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      let current = items[0].id;
      for (const item of items) {
        const top = headingEl(item.id)?.getBoundingClientRect().top;
        if (top !== undefined && top <= READ_LINE) current = item.id;
      }
      // Scrolled to the very bottom, the last heading is the one being read even if it never reaches the line.
      // (A page too short to scroll is "at the bottom" from the start; that doesn't count.)
      if (window.scrollY > 0 && window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) current = items[items.length - 1].id;
      setActive(current);
    };
    const onScroll = () => (frame ||= requestAnimationFrame(measure));
    onScroll();
    // Capture: the page may scroll inside a container rather than the window.
    document.addEventListener("scroll", onScroll, { capture: true, passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("scroll", onScroll, { capture: true });
      window.removeEventListener("resize", onScroll);
    };
  }, [items]);
  return items.some((i) => i.id === active) ? active : items[0]?.id;
}

export function jumpTo(id: string) {
  const el = headingEl(id);
  if (!el) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
}

/** Indent relative to the page's biggest heading, so a page of only H2s isn't pushed in. */
const indent = (items: TocItem[], level: number) => (level - Math.min(...items.map((i) => i.level))) * 12;

/** Desktop: the page's sections beside it, following the reader. */
export function TocRail({ items, active }: { items: TocItem[]; active?: string }) {
  return (
    <nav aria-label="On this page" className="flex flex-col gap-1">
      <span className="px-2 text-caption-1-semibold text-text-tertiary">On this page</span>
      <ul className="flex flex-col gap-0.5 border-s border-separator-border">
        {items.map((item) => {
          const current = item.id === active;
          return (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                aria-current={current ? "location" : undefined}
                onClick={(e) => {
                  e.preventDefault();
                  jumpTo(item.id);
                }}
                style={{ paddingInlineStart: `${10 + indent(items, item.level)}px` }}
                className={cx(
                  "-ms-px block border-s py-1 pe-2 text-body-2-regular outline-none transition-colors focus-visible:ring-2 focus-visible:ring-border-focus-ring",
                  current ? "border-text-primary text-text-primary" : "border-transparent text-text-tertiary hover:text-text-secondary",
                )}
              >
                <span className="line-clamp-2">{item.text}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Narrower screens: the same list behind a Contents button. */
export function TocMenu({ items, active }: { items: TocItem[]; active?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Dropdown isOpen={open} onOpenChange={setOpen}>
      <DropdownTrigger
        aria-label="On this page"
        className="flex h-7 items-center gap-1 rounded-lg px-2 text-body-2-medium text-text-secondary hover:bg-background-secondary-hover max-sm:h-11"
      >
        <RiListUnordered className="size-4 shrink-0 text-foreground-icon-secondary" aria-hidden />
        Contents
      </DropdownTrigger>
      <DropdownPopover aria-label="On this page" placement="bottom end" className="max-h-[60dvh] w-72">
        {items.map((item) => (
          <DropdownItem
            key={item.id}
            selected={item.id === active}
            className="py-1.5"
            onSelect={() => {
              setOpen(false);
              jumpTo(item.id);
            }}
          >
            <span className="line-clamp-2 text-body-medium" style={{ paddingInlineStart: `${indent(items, item.level)}px` }}>
              {item.text}
            </span>
          </DropdownItem>
        ))}
      </DropdownPopover>
    </Dropdown>
  );
}
