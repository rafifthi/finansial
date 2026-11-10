"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
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

/**
 * The heading being read: the last one that has scrolled past the top part
 * of the screen. A heading picked from the list holds the spot while the
 * page scrolls to it, so the marker goes straight there instead of ticking
 * through every section on the way.
 */
export function useActiveHeading(items: TocItem[]): [string | undefined, (id: string) => void] {
  const [active, setActive] = useState<string>();
  const pinned = useRef<string | null>(null);
  useEffect(() => {
    if (!items.length) return;
    let frame = 0;
    let release = 0;
    const measure = () => {
      frame = 0;
      if (pinned.current) return;
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
    const onScroll = () => {
      // The jump's own scrolling ends the hold once it settles.
      if (pinned.current) {
        window.clearTimeout(release);
        release = window.setTimeout(() => (pinned.current = null), 150);
        return;
      }
      frame ||= requestAnimationFrame(measure);
    };
    onScroll();
    // Capture: the page may scroll inside a container rather than the window.
    document.addEventListener("scroll", onScroll, { capture: true, passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(release);
      document.removeEventListener("scroll", onScroll, { capture: true });
      window.removeEventListener("resize", onScroll);
    };
  }, [items]);
  const pick = (id: string) => {
    pinned.current = id;
    setActive(id);
    jumpTo(id);
    // Already in place (no scroll happens): let go soon anyway.
    window.setTimeout(() => {
      if (pinned.current === id) pinned.current = null;
    }, 1200);
  };
  return [items.some((i) => i.id === active) ? active : items[0]?.id, pick];
}

export function jumpTo(id: string) {
  const el = headingEl(id);
  if (!el) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
}

/** Indent relative to the page's biggest heading, so a page of only H2s isn't pushed in. */
const indent = (items: TocItem[], level: number) => (level - Math.min(...items.map((i) => i.level))) * 12;

/**
 * Desktop: the page's sections beside it, as in the Next.js docs. One guide
 * line runs down the list; a marker on it slides to the section being read.
 */
export function TocRail({ items, active, onPick }: { items: TocItem[]; active?: string; onPick: (id: string) => void }) {
  const list = useRef<HTMLUListElement>(null);
  const [marker, setMarker] = useState<{ top: number; height: number } | null>(null);

  useLayoutEffect(() => {
    const el = list.current?.querySelector<HTMLElement>(`[data-toc-id="${active ? CSS.escape(active) : ""}"]`);
    if (!el) return;
    const place = () => setMarker({ top: el.offsetTop, height: el.offsetHeight });
    place();
    // Long titles wrap differently as the column resizes.
    const ro = new ResizeObserver(place);
    ro.observe(el);
    // Keep the current section in view in a long list, scrolling only the rail (never the page).
    const box = el.closest("aside");
    if (box && box.scrollHeight > box.clientHeight) {
      const top = el.getBoundingClientRect().top - box.getBoundingClientRect().top;
      if (top < 48 || top > box.clientHeight - 48) box.scrollTop += top - box.clientHeight / 3;
    }
    return () => ro.disconnect();
  }, [active, items]);

  return (
    <nav aria-label="On this page" className="flex flex-col gap-3">
      <h2 className="text-body-semibold text-text-primary">On this page</h2>
      <ul ref={list} className="relative flex flex-col border-s border-separator-border">
        {marker ? (
          <span
            aria-hidden
            className="absolute -start-px w-0.5 rounded-full bg-text-primary transition-[transform,height] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
            style={{ transform: `translateY(${marker.top}px)`, height: marker.height }}
          />
        ) : null}
        {items.map((item) => {
          const current = item.id === active;
          return (
            <li key={item.id} data-toc-id={item.id}>
              <a
                href={`#${item.id}`}
                aria-current={current ? "location" : undefined}
                onClick={(e) => {
                  e.preventDefault();
                  onPick(item.id);
                }}
                style={{ paddingInlineStart: `${14 + indent(items, item.level)}px` }}
                className={cx(
                  "block rounded-e-md py-1.5 pe-2 text-body-regular outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-border-focus-ring",
                  current ? "text-text-primary" : "text-text-tertiary hover:text-text-secondary",
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
export function TocMenu({ items, active, onPick }: { items: TocItem[]; active?: string; onPick: (id: string) => void }) {
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
              onPick(item.id);
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
