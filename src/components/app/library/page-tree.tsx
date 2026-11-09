"use client";

import { useMemo, useState } from "react";
import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { RiAddLine, RiArrowRightSLine, RiDeleteBinLine, RiFileTextLine, RiMoreLine } from "@remixicon/react";
import { Dropdown, DropdownItem, DropdownPopover, DropdownTrigger } from "@/components/base/dropdown/dropdown";
import { SpinnerGlyph } from "@/components/base/spinner/spinner";
import { ancestors, buildTree, pageTitle, type PageNode } from "@/lib/library/tree";
import type { Page } from "@/lib/sheets/schema";
import { cx } from "@/utils/cx";
import { useLibrary } from "./library-context";

const ICON_BUTTON = cx(
  "flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-foreground-icon-tertiary outline-none transition-colors max-sm:size-9",
  "hover:bg-background-tertiary-default hover:text-foreground-icon-primary focus-visible:ring-2 focus-visible:ring-border-focus-ring",
);

/** A page's actions: add a page inside it, or move it (and what's under it) to the trash. */
export function PageMenu({ page, compact }: { page: Page; compact?: boolean }) {
  const { create, archive } = useLibrary();
  const [open, setOpen] = useState(false);
  return (
    <Dropdown isOpen={open} onOpenChange={setOpen}>
      <DropdownTrigger aria-label={`More for ${pageTitle(page)}`} className={cx(ICON_BUTTON, !compact && "size-7 text-foreground-icon-secondary")}>
        <RiMoreLine className="size-4" aria-hidden />
      </DropdownTrigger>
      <DropdownPopover aria-label="Page actions" placement="bottom end" className="w-56">
        <DropdownItem
          onSelect={() => {
            setOpen(false);
            create(page.id);
          }}
        >
          <RiAddLine className="size-4 text-foreground-icon-secondary" aria-hidden />
          <span className="text-body-medium">Add a page inside</span>
        </DropdownItem>
        <DropdownItem
          onSelect={() => {
            setOpen(false);
            archive(page);
          }}
        >
          <RiDeleteBinLine className="size-4 text-foreground-icon-error" aria-hidden />
          <span className="text-body-medium text-text-error-primary">Move to trash</span>
        </DropdownItem>
      </DropdownPopover>
    </Dropdown>
  );
}

function RowLabel({ page, current }: { page: Page; current: boolean }) {
  const { pending } = useLinkStatus();
  return (
    <>
      {pending ? (
        <SpinnerGlyph size="xs" />
      ) : page.emoji ? (
        <span className="w-4 shrink-0 text-center text-body-regular" aria-hidden>
          {page.emoji}
        </span>
      ) : (
        <RiFileTextLine className="size-4 shrink-0 text-foreground-icon-tertiary" aria-hidden />
      )}
      <span className={cx("truncate text-body-medium", current ? "text-text-primary" : "text-text-secondary", !page.title.trim() && "text-text-tertiary")}>{pageTitle(page)}</span>
    </>
  );
}

function TreeRow({ node, depth, currentId, expanded, toggle }: { node: PageNode; depth: number; currentId?: string; expanded: Set<string>; toggle: (id: string) => void }) {
  const { href, canEdit, create } = useLibrary();
  const { page, children } = node;
  const open = expanded.has(page.id);
  const current = page.id === currentId;
  return (
    <li className="flex flex-col">
      <div
        className={cx(
          "group flex h-7 items-center gap-0.5 rounded-lg pe-1 transition-colors max-sm:h-11",
          // The panel is surface 1, so the current row steps down a shade rather than up.
          current ? "bg-background-secondary-hover" : "hover:bg-background-secondary-default",
        )}
        style={{ paddingInlineStart: `${depth * 12}px` }}
      >
        {children.length ? (
          <button type="button" aria-label={`Pages inside ${pageTitle(page)}`} aria-expanded={open} onClick={() => toggle(page.id)} className={ICON_BUTTON}>
            <RiArrowRightSLine className={cx("size-4 transition-transform rtl:-scale-x-100", open && "rotate-90 rtl:rotate-90")} aria-hidden />
          </button>
        ) : (
          <span className="size-6 shrink-0 max-sm:size-9" aria-hidden />
        )}
        <Link
          href={href(page.id)}
          aria-current={current ? "page" : undefined}
          className="flex min-w-0 flex-1 items-center gap-2 self-stretch rounded-md outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring"
        >
          <RowLabel page={page} current={current} />
        </Link>
        {canEdit ? (
          <span className="flex items-center opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 max-lg:opacity-100">
            <PageMenu page={page} compact />
            <button type="button" aria-label={`Add a page inside ${pageTitle(page)}`} onClick={() => create(page.id)} className={ICON_BUTTON}>
              <RiAddLine className="size-4" aria-hidden />
            </button>
          </span>
        ) : null}
      </div>
      {children.length && open ? (
        <ul className="flex flex-col gap-0.5 pt-0.5">
          {children.map((c) => (
            <TreeRow key={c.page.id} node={c} depth={depth + 1} currentId={currentId} expanded={expanded} toggle={toggle} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

/** The Library's pages as a tree; the open page and the pages above it start expanded. */
export function PageTree({ className }: { className?: string }) {
  const { pages, href, canEdit, create } = useLibrary();
  const pathname = usePathname();
  const base = href();
  const currentId = pathname.startsWith(`${base}/`) ? pathname.slice(base.length + 1).split("/")[0] : undefined;
  const tree = useMemo(() => buildTree(pages), [pages]);
  const [opened, setOpened] = useState<Set<string>>(() => new Set());
  const [closed, setClosed] = useState<Set<string>>(() => new Set());
  // Pages above the current one are open unless closed by hand.
  const expanded = useMemo(() => {
    const out = new Set(opened);
    if (currentId) for (const p of ancestors(pages, currentId)) if (!closed.has(p.id)) out.add(p.id);
    return out;
  }, [opened, closed, currentId, pages]);
  const toggle = (id: string) => {
    const isOpen = expanded.has(id);
    setOpened((s) => {
      const n = new Set(s);
      if (isOpen) n.delete(id);
      else n.add(id);
      return n;
    });
    setClosed((s) => {
      const n = new Set(s);
      if (isOpen) n.add(id);
      else n.delete(id);
      return n;
    });
  };

  return (
    <nav aria-label="Pages" className={cx("flex flex-col gap-1", className)}>
      <div className="flex items-center justify-between gap-2 ps-2">
        <span className="text-caption-1-semibold text-text-tertiary">Pages</span>
        {canEdit ? (
          <button type="button" aria-label="New page" onClick={() => create()} className={ICON_BUTTON}>
            <RiAddLine className="size-4" aria-hidden />
          </button>
        ) : null}
      </div>
      {tree.length ? (
        <ul className="flex flex-col gap-0.5">
          {tree.map((n) => (
            <TreeRow key={n.page.id} node={n} depth={0} currentId={currentId} expanded={expanded} toggle={toggle} />
          ))}
        </ul>
      ) : (
        <p className="px-2 py-3 text-body-2-regular text-text-tertiary">{canEdit ? "No pages yet. Add one with +." : "No pages yet."}</p>
      )}
    </nav>
  );
}
