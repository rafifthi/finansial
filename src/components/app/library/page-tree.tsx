"use client";

import { createContext, useContext, useMemo, useState, type DragEvent } from "react";
import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { RiAddLine, RiArrowDownLine, RiArrowLeftUpLine, RiArrowRightSLine, RiArrowUpLine, RiAtLine, RiDeleteBinLine, RiFileTextLine, RiMoreLine, RiSearchLine } from "@remixicon/react";
import { Badge } from "@/components/base/badges/badge";
import { Dropdown, DropdownDivider, DropdownItem, DropdownPopover, DropdownTrigger } from "@/components/base/dropdown/dropdown";
import { SpinnerGlyph } from "@/components/base/spinner/spinner";
import { ancestors, buildTree, pageTitle, planMove, stepMove, type DropZone, type PageNode } from "@/lib/library/tree";
import type { Page } from "@/lib/sheets/schema";
import { cx } from "@/utils/cx";
import { useLibrary } from "./library-context";

const ICON_BUTTON = cx(
  "flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-foreground-icon-tertiary outline-none transition-colors max-sm:size-9",
  "hover:bg-background-tertiary-default hover:text-foreground-icon-primary focus-visible:ring-2 focus-visible:ring-border-focus-ring",
);

/** A page's actions: add a page inside it, or move it (and what's under it) to the trash. */
export function PageMenu({ page, compact }: { page: Page; compact?: boolean }) {
  const { create, archive, pages, move } = useLibrary();
  const [open, setOpen] = useState(false);
  // The keyboard way to reorder (dragging needs a pointer).
  const steps = [
    { step: "up" as const, label: "Move up", icon: RiArrowUpLine },
    { step: "down" as const, label: "Move down", icon: RiArrowDownLine },
    { step: "out" as const, label: "Move out of its parent", icon: RiArrowLeftUpLine },
  ]
    .map((s) => ({ ...s, to: stepMove(pages, page.id, s.step) }))
    .filter((s) => s.to);
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
        {steps.map((s) => (
          <DropdownItem
            key={s.step}
            onSelect={() => {
              setOpen(false);
              move(page.id, s.to!);
            }}
          >
            <s.icon className="size-4 text-foreground-icon-secondary" aria-hidden />
            <span className="text-body-medium">{s.label}</span>
          </DropdownItem>
        ))}
        <DropdownDivider />
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

type Variant = "sidebar" | "panel";

/** Sidebar rows match the nav rows above them; panel rows (the phone Library home) step down a shade on surface 1. */
const ROW: Record<Variant, { current: string; rest: string; indent: number }> = {
  sidebar: { current: "bg-background-primary-default shadow-xs", rest: "hover:bg-background-secondary-hover", indent: 4 },
  panel: { current: "bg-background-secondary-hover", rest: "hover:bg-background-secondary-default", indent: 0 },
};

interface TreeDrag {
  dragging: string | null;
  drop: { id: string; zone: DropZone } | null;
  start: (id: string, e: DragEvent) => void;
  over: (id: string, e: DragEvent) => void;
  land: (id: string, e: DragEvent) => void;
  end: () => void;
}

const TreeDragContext = createContext<TreeDrag | null>(null);

/** Top quarter: before it. Bottom quarter: after it. Middle: inside it. */
function zoneAt(e: DragEvent): DropZone {
  const box = (e.currentTarget as HTMLElement).getBoundingClientRect();
  const y = (e.clientY - box.top) / box.height;
  return y < 0.25 ? "before" : y > 0.75 ? "after" : "inside";
}

function TreeRow({ node, depth, currentId, expanded, toggle, variant }: { node: PageNode; depth: number; currentId?: string; expanded: Set<string>; toggle: (id: string) => void; variant: Variant }) {
  const { href, canEdit, create } = useLibrary();
  const drag = useContext(TreeDragContext);
  const { page, children } = node;
  const open = expanded.has(page.id);
  const current = page.id === currentId;
  const zone = drag?.drop?.id === page.id ? drag.drop.zone : null;
  return (
    <li className="flex flex-col">
      <div
        draggable={canEdit && Boolean(drag)}
        onDragStart={(e) => drag?.start(page.id, e)}
        onDragOver={(e) => drag?.over(page.id, e)}
        onDrop={(e) => drag?.land(page.id, e)}
        onDragEnd={() => drag?.end()}
        className={cx(
          "group relative flex h-7 items-center gap-0.5 rounded-lg pe-1 transition-colors max-sm:h-11",
          current ? ROW[variant].current : ROW[variant].rest,
          drag?.dragging === page.id && "opacity-50",
          // Dropping inside: the row lights up. Before or after: a line where it will land.
          zone === "inside" && "ring-2 ring-inset ring-border-focus-ring",
          zone === "before" && "before:absolute before:inset-x-1 before:-top-px before:h-0.5 before:rounded-full before:bg-accent-solid",
          zone === "after" && "after:absolute after:inset-x-1 after:-bottom-px after:h-0.5 after:rounded-full after:bg-accent-solid",
        )}
        style={{ paddingInlineStart: `${ROW[variant].indent + depth * 12}px` }}
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
          draggable={false}
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
            <TreeRow key={c.page.id} node={c} depth={depth + 1} currentId={currentId} expanded={expanded} toggle={toggle} variant={variant} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

/** Opens the Library search (also ⌘/Ctrl+Shift+F). */
function SearchRow({ variant }: { variant: Variant }) {
  const { openSearch } = useLibrary();
  return (
    <button
      type="button"
      onClick={openSearch}
      aria-keyshortcuts="Meta+Shift+F Control+Shift+F"
      className={cx(
        "flex h-7 w-full cursor-pointer items-center gap-2 rounded-lg ps-[30px] pe-1.5 text-start outline-none transition-colors focus-visible:ring-2 focus-visible:ring-border-focus-ring max-sm:h-11",
        ROW[variant].rest,
      )}
    >
      <RiSearchLine className="size-4 shrink-0 text-foreground-icon-tertiary" aria-hidden />
      <span className="flex-1 truncate text-body-medium text-text-secondary">Search</span>
    </button>
  );
}

/** The inbox of pages and comments that mention you, with how many are new. */
function MentionsRow({ variant }: { variant: Variant }) {
  const { href, unreadMentions } = useLibrary();
  const pathname = usePathname();
  const target = `${href()}/mentions`;
  const current = pathname === target;
  return (
    <Link
      href={target}
      aria-current={current ? "page" : undefined}
      className={cx(
        // Its icon lines up with the page icons below (past the expand arrow's slot).
        "flex h-7 items-center gap-2 rounded-lg ps-[30px] pe-1.5 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-border-focus-ring max-sm:h-11",
        current ? ROW[variant].current : ROW[variant].rest,
      )}
    >
      <RiAtLine className="size-4 shrink-0 text-foreground-icon-tertiary" aria-hidden />
      <span className={cx("flex-1 truncate text-body-medium", current ? "text-text-primary" : "text-text-secondary")}>Mentions</span>
      {unreadMentions ? (
        <Badge color="neutral" aria-label={`${unreadMentions} new`}>
          {unreadMentions}
        </Badge>
      ) : null}
    </Link>
  );
}

/**
 * The Library's pages as a tree; the open page and the pages above it start
 * expanded. On desktop it sits in the main sidebar under the Library row; on
 * phones it is the Library home.
 */
export function PageTree({ className, variant = "panel" }: { className?: string; variant?: Variant }) {
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

  // Dragging a page onto another: before it, after it, or inside it.
  const { move } = useLibrary();
  const [dragging, setDragging] = useState<string | null>(null);
  const [drop, setDrop] = useState<{ id: string; zone: DropZone } | null>(null);
  const drag: TreeDrag = {
    dragging,
    drop,
    start: (id, e) => {
      setDragging(id);
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", pageTitle(pages.find((p) => p.id === id) ?? { title: "" }));
    },
    over: (id, e) => {
      if (!dragging) return;
      const zone = zoneAt(e);
      if (!planMove(pages, dragging, id, zone)) return setDrop(null);
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (drop?.id !== id || drop.zone !== zone) setDrop({ id, zone });
    },
    land: (id, e) => {
      e.preventDefault();
      const to = dragging ? planMove(pages, dragging, id, zoneAt(e)) : null;
      if (dragging && to) {
        move(dragging, to);
        // Dropped inside a page: show it there.
        if (to.parent_id && !expanded.has(to.parent_id)) toggle(to.parent_id);
      }
      setDragging(null);
      setDrop(null);
    },
    end: () => {
      setDragging(null);
      setDrop(null);
    },
  };

  if (variant === "sidebar") {
    return (
      <TreeDragContext.Provider value={drag}>
      <ul aria-label="Library pages" className={cx("flex flex-col gap-0.5 pt-0.5", className)}>
        <li>
          <SearchRow variant="sidebar" />
        </li>
        <li>
          <MentionsRow variant="sidebar" />
        </li>
        {tree.map((n) => (
          <TreeRow key={n.page.id} node={n} depth={0} currentId={currentId} expanded={expanded} toggle={toggle} variant="sidebar" />
        ))}
        {canEdit ? (
          <li>
            <button
              type="button"
              onClick={() => create()}
              className="flex h-7 w-full cursor-pointer items-center gap-2 rounded-lg ps-[30px] text-start text-body-medium text-text-tertiary outline-none transition-colors hover:bg-background-secondary-hover hover:text-text-secondary focus-visible:ring-2 focus-visible:ring-border-focus-ring"
            >
              <RiAddLine className="size-4 shrink-0" aria-hidden />
              New page
            </button>
          </li>
        ) : null}
      </ul>
      </TreeDragContext.Provider>
    );
  }

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
      <SearchRow variant="panel" />
      <MentionsRow variant="panel" />
      {tree.length ? (
        <TreeDragContext.Provider value={drag}>
          <ul className="flex flex-col gap-0.5">
            {tree.map((n) => (
              <TreeRow key={n.page.id} node={n} depth={0} currentId={currentId} expanded={expanded} toggle={toggle} variant="panel" />
            ))}
          </ul>
        </TreeDragContext.Provider>
      ) : (
        <p className="px-2 py-3 text-body-2-regular text-text-tertiary">{canEdit ? "No pages yet. Add one with +." : "No pages yet."}</p>
      )}
    </nav>
  );
}
