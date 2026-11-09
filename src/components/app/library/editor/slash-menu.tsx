"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Extension } from "@tiptap/core";
import { ReactRenderer } from "@tiptap/react";
import Suggestion, { type SuggestionKeyDownProps, type SuggestionProps } from "@tiptap/suggestion";
import { MENU_ITEM, MENU_ITEM_ACTIVE, MENU_POPOVER_SURFACE } from "@/components/base/dropdown/menu-styles";
import { cx } from "@/utils/cx";
import { filterSlashItems, runSlashItem, SLASH_SECTIONS, slashContext, type SlashItem } from "./slash-items";

interface MenuHandle {
  onKeyDown: (e: KeyboardEvent) => boolean;
}

type MenuProps = Pick<SuggestionProps<SlashItem, SlashItem>, "items" | "command" | "query" | "editor">;

let menuCount = 0;

/**
 * The / menu's list. Typing stays in the editor, so the list is a listbox the
 * editor points at with aria-activedescendant rather than one that takes focus.
 */
const SlashList = forwardRef<MenuHandle, MenuProps & { id: string }>(function SlashList({ items, command, query, editor, id }, ref) {
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const at = Math.min(active, Math.max(0, items.length - 1));

  // A new query starts at the top again.
  useEffect(() => setActive(0), [query]);

  const activeKey = items[at]?.key;
  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${at}"]`)?.scrollIntoView({ block: "nearest" });
    const dom = editor.view.dom;
    if (activeKey) dom.setAttribute("aria-activedescendant", `${id}-${activeKey}`);
    else dom.removeAttribute("aria-activedescendant");
  }, [at, activeKey, editor, id]);

  useImperativeHandle(ref, () => ({
    onKeyDown(e) {
      if (!items.length) return false;
      if (e.key === "ArrowDown") {
        setActive((at + 1) % items.length);
        return true;
      }
      if (e.key === "ArrowUp") {
        setActive((at - 1 + items.length) % items.length);
        return true;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        command(items[at]);
        return true;
      }
      return false;
    },
  }));

  if (!items.length) {
    return (
      <div className={cx(MENU_POPOVER_SURFACE, "w-60 p-2")}>
        <p className="px-2 py-1.5 text-body-regular text-text-tertiary">No matches</p>
      </div>
    );
  }

  return (
    <div ref={listRef} id={id} role="listbox" aria-label="Blocks" className={cx(MENU_POPOVER_SURFACE, "flex max-h-80 w-60 flex-col gap-1 p-2")}>
      {SLASH_SECTIONS.map((section) => {
        const inSection = items.filter((i) => i.section === section);
        if (!inSection.length) return null;
        return (
          <div key={section} role="group" aria-label={section} className="flex flex-col gap-0.5">
            <span className="px-2 pt-1 text-caption-1-medium text-text-tertiary">{section}</span>
            {inSection.map((item) => {
              const index = items.indexOf(item);
              return (
                <div
                  key={item.key}
                  id={`${id}-${item.key}`}
                  role="option"
                  aria-selected={index === at}
                  data-index={index}
                  // Keep focus (and the typed query) in the editor.
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseMove={() => index !== at && setActive(index)}
                  onClick={() => command(item)}
                  className={cx(MENU_ITEM, "py-1.5", index === at && MENU_ITEM_ACTIVE)}
                >
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-separator-border bg-background-primary-default">
                    <item.icon className="size-4 text-foreground-icon-secondary" aria-hidden />
                  </span>
                  <span className="text-body-medium">{item.label}</span>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
});

/**
 * Typing "/" at the start of a line or after a space opens the block menu at
 * the cursor. Inside a word, in code, or where nothing applies it stays text.
 */
export const SlashMenu = Extension.create({
  name: "slashMenu",

  addProseMirrorPlugins() {
    return [
      Suggestion<SlashItem, SlashItem>({
        editor: this.editor,
        char: "/",
        allowedPrefixes: [" "],
        allow: ({ state, range }) => {
          const $from = state.doc.resolve(range.from);
          return !$from.parent.type.spec.code;
        },
        items: ({ query, editor }) => filterSlashItems(query, slashContext(editor)),
        command: ({ editor, range, props }) => runSlashItem(editor, range, props),
        render: () => {
          let renderer: ReactRenderer<MenuHandle, MenuProps & { id: string }> | undefined;
          let unmount: (() => void) | undefined;
          const id = `slash-menu-${++menuCount}`;
          const point = (props: SuggestionProps<SlashItem, SlashItem>, on: boolean) => {
            const dom = props.editor.view.dom;
            if (on) {
              dom.setAttribute("aria-controls", id);
              dom.setAttribute("aria-expanded", "true");
            } else {
              dom.removeAttribute("aria-controls");
              dom.removeAttribute("aria-expanded");
              dom.removeAttribute("aria-activedescendant");
            }
          };
          return {
            onStart: (props) => {
              renderer = new ReactRenderer(SlashList, { props: { ...props, id }, editor: props.editor });
              unmount = props.mount(renderer.element as HTMLElement);
              point(props, true);
            },
            onUpdate: (props) => renderer?.updateProps({ ...props, id }),
            onKeyDown: (props: SuggestionKeyDownProps) => renderer?.ref?.onKeyDown(props.event) ?? false,
            onExit: (props) => {
              point(props, false);
              unmount?.();
              renderer?.destroy();
              renderer = undefined;
            },
          };
        },
      }),
    ];
  },
});
