"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Dialog as AriaDialog, Popover as AriaPopover } from "react-aria-components";
import type { Editor } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import { NodeSelection, TextSelection } from "@tiptap/pm/state";
import { RiAddLine, RiChat3Line, RiDeleteBinLine, RiDraggable, RiFileCopyLine } from "@remixicon/react";
import { DropdownDivider, DropdownGroup, DropdownItem } from "@/components/base/dropdown/dropdown";
import { MENU_POPOVER_SURFACE } from "@/components/base/dropdown/menu-styles";
import { cx } from "@/utils/cx";
import { useOverlayRoot } from "./overlay-root";
import { SLASH_ITEMS } from "./slash-items";

interface Target {
  pos: number;
  node: PMNode;
  dom: HTMLElement;
}

const ITEM_TYPES = new Set(["listItem", "taskItem"]);

/** The block under the pointer: a list item when over a list, else the top-level block. */
function blockAt(editor: Editor, x: number, y: number): Target | null {
  const { view } = editor;
  const box = view.dom.getBoundingClientRect();
  // From the gutter, look straight across into the page.
  const hit = view.posAtCoords({ left: Math.max(x, box.left + 2), top: y });
  if (!hit) return null;
  const $pos = view.state.doc.resolve(hit.pos);
  let depth = Math.min(1, $pos.depth);
  for (let d = $pos.depth; d > 0; d--) {
    if (ITEM_TYPES.has($pos.node(d).type.name)) {
      depth = d;
      break;
    }
  }
  if (depth < 1) {
    // Between blocks: the node right after the position.
    const node = view.state.doc.nodeAt(hit.pos);
    const dom = node && (view.nodeDOM(hit.pos) as HTMLElement | null);
    return node && dom instanceof HTMLElement ? { pos: hit.pos, node, dom } : null;
  }
  const pos = $pos.before(depth);
  const node = view.state.doc.nodeAt(pos);
  const dom = view.nodeDOM(pos);
  return node && dom instanceof HTMLElement ? { pos, node, dom } : null;
}

const HANDLE = cx(
  "flex size-6 cursor-pointer items-center justify-center rounded-md text-foreground-icon-tertiary outline-none transition-colors",
  "hover:bg-background-secondary-hover hover:text-foreground-icon-secondary focus-visible:ring-2 focus-visible:ring-border-focus-ring",
);

/**
 * The handle beside the block under the pointer: + adds a block below and
 * opens the / menu; the grip drags the block to a new place (ProseMirror's
 * own drop, so its id and comments move with it) or, clicked, opens a menu
 * to turn it into another block, duplicate or delete it.
 */
export function BlockHandle({ editor, onComment }: { editor: Editor; onComment?: (id: string, text: string) => void }) {
  const host = editor.view.dom.parentElement;
  const overlay = useOverlayRoot(host);
  const [target, setTarget] = useState<Target | null>(null);
  const [menu, setMenu] = useState(false);
  const grip = useRef<HTMLButtonElement>(null);
  // While its menu is open the handle stays put.
  const pinned = useRef(false);
  useEffect(() => {
    pinned.current = menu;
  }, [menu]);

  useEffect(() => {
    if (!host) return;
    // The page's left gutter counts as hovering the block beside it.
    const area = host.closest("[data-block-area]") ?? host;
    let hideTimer = 0;
    const onMove = (e: MouseEvent) => {
      if (pinned.current || editor.view.dragging) return;
      window.clearTimeout(hideTimer);
      const next = blockAt(editor, e.clientX, e.clientY);
      setTarget((cur) => (cur?.dom === next?.dom && cur?.pos === next?.pos ? cur : next));
    };
    const onLeave = () => {
      if (pinned.current) return;
      hideTimer = window.setTimeout(() => setTarget(null), 150);
    };
    // Typing hides it, as the pointer is usually resting somewhere unrelated.
    const onKey = () => !pinned.current && setTarget(null);
    area.addEventListener("mousemove", onMove as EventListener);
    area.addEventListener("mouseleave", onLeave);
    editor.view.dom.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(hideTimer);
      area.removeEventListener("mousemove", onMove as EventListener);
      area.removeEventListener("mouseleave", onLeave);
      editor.view.dom.removeEventListener("keydown", onKey);
    };
  }, [editor, host]);

  // A change elsewhere can move the block; drop the target if its node is gone.
  useEffect(() => {
    const onUpdate = () => setTarget((t) => (t && t.dom.isConnected ? t : null));
    editor.on("update", onUpdate);
    return () => void editor.off("update", onUpdate);
  }, [editor]);

  if (!host || !overlay || !target || !editor.isEditable) return null;

  const hostBox = host.getBoundingClientRect();
  const box = target.dom.getBoundingClientRect();
  const style = getComputedStyle(target.dom);
  const line = parseFloat(style.lineHeight) || 20;
  const isItem = ITEM_TYPES.has(target.node.type.name);
  // List items start at their text; leave room for the bullet or number.
  const left = box.left - hostBox.left - (isItem ? 22 : 0) - 52;
  const top = box.top - hostBox.top + parseFloat(style.paddingTop || "0") + (Math.min(line, 32) - 24) / 2;

  const current = () => {
    // Positions move as the page changes; find the block again by its DOM node.
    const pos = editor.view.posAtDOM(target.dom, 0) - 1;
    const node = editor.state.doc.nodeAt(pos);
    return node && node.type === target.node.type ? { pos, node } : { pos: target.pos, node: target.node };
  };

  const addBelow = () => {
    const { pos, node } = current();
    const after = pos + node.nodeSize;
    const content = isItem ? { type: node.type.name, content: [{ type: "paragraph" }] } : { type: "paragraph" };
    editor
      .chain()
      .insertContentAt(after, content)
      .setTextSelection(after + (isItem ? 2 : 1))
      .insertContent("/")
      .focus()
      .run();
  };

  const select = () => {
    const { pos } = current();
    editor.view.dispatch(editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, pos)));
  };

  const onDragStart = (e: React.DragEvent) => startDrag(editor, current().pos, target.dom, e.dataTransfer);

  const close = () => setMenu(false);
  // Only block types a line can become; tables, dividers and inline bits are inserted, not turned into.
  const turnInto = SLASH_ITEMS.filter((i) => !i.inline && i.key !== "divider" && i.key !== "table");
  const textual = target.node.isTextblock || isItem;

  return createPortal(
    <>
      <div
        className="absolute z-10 flex items-center gap-0.5"
        style={{ left, top }}
        // Hovering the handle keeps it; it lives inside the hover area's host.
        onMouseDown={(e) => e.stopPropagation()}
        contentEditable={false}
      >
        <button type="button" aria-label="Add a block below" title="Add a block below" onClick={addBelow} className={HANDLE}>
          <RiAddLine className="size-4" aria-hidden />
        </button>
        <button
          ref={grip}
          type="button"
          draggable
          aria-label="Drag to move, or click for block options"
          title="Drag to move · Click for options"
          aria-haspopup="dialog"
          aria-expanded={menu}
          onDragStart={onDragStart}
          onClick={() => {
            select();
            setMenu(true);
          }}
          className={cx(HANDLE, "cursor-grab active:cursor-grabbing")}
        >
          <RiDraggable className="size-4" aria-hidden />
        </button>
      </div>
      <AriaPopover
        triggerRef={grip}
        isOpen={menu}
        onOpenChange={(open) => {
          setMenu(open);
          if (!open) editor.commands.focus();
        }}
        placement="bottom start"
        offset={4}
        className={cx(MENU_POPOVER_SURFACE, "w-56")}
      >
        <AriaDialog aria-label="Block options" className="flex flex-col gap-1 outline-none">
          {textual ? (
            <DropdownGroup label="Turn into">
              {turnInto.map((item) => (
                <DropdownItem
                  key={item.key}
                  className="py-1.5"
                  onSelect={() => {
                    close();
                    const { pos } = current();
                    editor.view.dispatch(editor.state.tr.setSelection(TextSelection.near(editor.state.doc.resolve(pos + 1))));
                    item.apply(editor);
                    editor.commands.focus();
                  }}
                >
                  <item.icon className="size-4 text-foreground-icon-secondary" aria-hidden />
                  <span className="text-body-medium">{item.label}</span>
                </DropdownItem>
              ))}
            </DropdownGroup>
          ) : null}
          {textual ? <DropdownDivider /> : null}
          {onComment && typeof target.node.attrs.id === "string" ? (
            <DropdownItem
              className="py-1.5"
              onSelect={() => {
                close();
                const { pos, node } = current();
                onComment(node.attrs.id as string, editor.state.doc.textBetween(pos, pos + node.nodeSize, " ", " "));
              }}
            >
              <RiChat3Line className="size-4 text-foreground-icon-secondary" aria-hidden />
              <span className="text-body-medium">Comment</span>
            </DropdownItem>
          ) : null}
          <DropdownItem
            className="py-1.5"
            onSelect={() => {
              close();
              const { pos, node } = current();
              // A copy without ids; the editor gives it fresh ones.
              const copy = node.type.schema.nodeFromJSON(stripIds(node.toJSON()));
              editor.view.dispatch(editor.state.tr.insert(pos + node.nodeSize, copy));
              editor.commands.focus();
            }}
          >
            <RiFileCopyLine className="size-4 text-foreground-icon-secondary" aria-hidden />
            <span className="text-body-medium">Duplicate</span>
          </DropdownItem>
          <DropdownItem
            className="py-1.5"
            onSelect={() => {
              close();
              const { pos, node } = current();
              editor.view.dispatch(editor.state.tr.delete(pos, pos + node.nodeSize));
              setTarget(null);
              editor.commands.focus();
            }}
          >
            <RiDeleteBinLine className="size-4 text-foreground-icon-error" aria-hidden />
            <span className="text-body-medium text-text-error-primary">Delete</span>
          </DropdownItem>
        </AriaDialog>
      </AriaPopover>
    </>,
    overlay,
  );
}

/**
 * Hands the block to ProseMirror's own drag and drop: it draws the drop line
 * and moves the node on drop. "move" (not copy) keeps the block's ids.
 */
function startDrag(editor: Editor, pos: number, image: HTMLElement, data: DataTransfer) {
  const { view } = editor;
  const sel = NodeSelection.create(view.state.doc, pos);
  view.dispatch(view.state.tr.setSelection(sel));
  const slice = sel.content();
  const { dom, text } = view.serializeForClipboard(slice);
  data.clearData();
  data.setData("text/html", dom.innerHTML);
  data.setData("text/plain", text);
  data.effectAllowed = "move";
  data.setDragImage(image, 0, 0);
  view.dragging = { slice, move: true };
}

type Json = { attrs?: Record<string, unknown>; content?: Json[] } & Record<string, unknown>;

function stripIds(json: Json): Json {
  return {
    ...json,
    ...(json.attrs ? { attrs: { ...json.attrs, id: null } } : {}),
    ...(json.content ? { content: json.content.map(stripIds) } : {}),
  };
}
