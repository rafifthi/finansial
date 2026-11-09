"use client";

import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import Mention from "@tiptap/extension-mention";
import type { SuggestionProps } from "@tiptap/suggestion";
import { Avatar } from "@/components/base/avatar/avatar";
import { MENU_ITEM, MENU_ITEM_ACTIVE, MENU_POPOVER_SURFACE } from "@/components/base/dropdown/menu-styles";
import { cx } from "@/utils/cx";
import type { LibraryMember } from "../library-context";
import { suggestionPopup, type SuggestionHandle } from "./suggestion-popup";

type ListProps = Pick<SuggestionProps<LibraryMember, { id: string; label: string }>, "items" | "command" | "query" | "editor"> & { id: string };

/** The people matching what follows "@", first names first. */
export function matchMembers(members: LibraryMember[], query: string): LibraryMember[] {
  const q = query.trim().toLowerCase();
  if (!q) return members;
  const starts = members.filter((m) => m.name.toLowerCase().split(/\s+/).some((w) => w.startsWith(q)));
  const contains = members.filter((m) => !starts.includes(m) && m.name.toLowerCase().includes(q));
  return [...starts, ...contains];
}

const MentionList = forwardRef<SuggestionHandle, ListProps>(function MentionList({ items, command, query, editor, id }, ref) {
  const [active, setActive] = useState(0);
  const at = Math.min(active, Math.max(0, items.length - 1));
  useEffect(() => setActive(0), [query]);
  const activeId = items[at]?.id;
  useEffect(() => {
    const dom = editor.view.dom;
    if (activeId) dom.setAttribute("aria-activedescendant", `${id}-${activeId}`);
    else dom.removeAttribute("aria-activedescendant");
  }, [activeId, editor, id]);

  const pick = (m: LibraryMember) => command({ id: m.id, label: m.name });
  useImperativeHandle(ref, () => ({
    onKeyDown(e) {
      if (!items.length) return false;
      if (e.key === "ArrowDown") return setActive((at + 1) % items.length), true;
      if (e.key === "ArrowUp") return setActive((at - 1 + items.length) % items.length), true;
      if (e.key === "Enter" || e.key === "Tab") return pick(items[at]), true;
      return false;
    },
  }));

  if (!items.length) {
    return (
      <div className={cx(MENU_POPOVER_SURFACE, "w-56 p-2")}>
        <p className="px-2 py-1.5 text-body-regular text-text-tertiary">No one in this book matches “{query}”.</p>
      </div>
    );
  }
  return (
    <div id={id} role="listbox" aria-label="People" className={cx(MENU_POPOVER_SURFACE, "flex max-h-72 w-56 flex-col gap-0.5 p-2")}>
      {items.map((m, i) => (
        <div
          key={m.id}
          id={`${id}-${m.id}`}
          role="option"
          aria-selected={i === at}
          onMouseDown={(e) => e.preventDefault()}
          onMouseMove={() => i !== at && setActive(i)}
          onClick={() => pick(m)}
          className={cx(MENU_ITEM, "py-1.5", i === at && MENU_ITEM_ACTIVE)}
        >
          <Avatar size="sm" initials={m.name.slice(0, 1).toUpperCase()} />
          <span className="truncate text-body-medium">{m.name}</span>
        </div>
      ))}
    </div>
  );
});

/**
 * "@" lists the book's people; picking one drops a chip that names them.
 * The chip keeps the person's id, so it still points at them if they rename.
 */
export function peopleMentions(members: LibraryMember[], me: string) {
  return Mention.configure({
    HTMLAttributes: { class: "mention" },
    renderText: ({ node }) => `@${node.attrs.label ?? ""}`,
    // A mention of whoever is reading stands out (the solid fill in library.css).
    renderHTML: ({ options, node }) => [
      "span",
      { ...options.HTMLAttributes, class: node.attrs.id === me ? "mention mention-me" : "mention", "data-mention-id": node.attrs.id },
      `@${node.attrs.label ?? ""}`,
    ],
    suggestion: {
      char: "@",
      allowedPrefixes: [" ", "("],
      allow: ({ state, range }) => !state.doc.resolve(range.from).parent.type.spec.code,
      items: ({ query }) => matchMembers(members, query).slice(0, 8),
      render: suggestionPopup<LibraryMember, ListProps>(MentionList, "mention-menu"),
    },
  });
}
