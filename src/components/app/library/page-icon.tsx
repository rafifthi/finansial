"use client";

import { useRef, useState } from "react";
import { Dialog as AriaDialog, Popover as AriaPopover } from "react-aria-components";
import { RiEmotionLine, RiSearchLine } from "@remixicon/react";
import { Button } from "@/components/base/buttons/button";
import { MENU_POPOVER_SURFACE } from "@/components/base/dropdown/menu-styles";
import { Input } from "@/components/base/input/input";
import { EMOJI_GROUPS, searchEmoji } from "@/lib/emoji-catalog";
import { cx } from "@/utils/cx";
import { EmojiGrid } from "../category-identity-field";
import { firstGrapheme } from "../category-icon";

/** What household pages tend to be about, ahead of the category groups. */
const PAGE_EMOJI = ["📄", "📝", "📌", "📚", "🗂️", "📋", "🏠", "🔑", "💡", "🧾", "📞", "🩺", "🚗", "✈️", "🎉", "🛒", "👶", "🐾", "🌱", "🔧", "💰", "📅", "⭐", "❤️"];
const GROUPS = [{ id: "pages", label: "Pages", items: PAGE_EMOJI }, ...EMOJI_GROUPS.map((g) => ({ id: g.id, label: g.label, items: g.items.map(([e]) => e) }))];

/**
 * The emoji beside a page's title. Pressing it (or "Add icon" while there's
 * none) opens a picker: search, a few groups, or any emoji pasted or typed.
 */
export function PageIcon({ emoji, onChange, canEdit }: { emoji: string; onChange: (emoji: string) => void; canEdit: boolean }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState(GROUPS[0].id);
  const trigger = useRef<HTMLButtonElement>(null);
  const results = query.trim() ? searchEmoji(query) : null;
  const shown = results ?? GROUPS.find((g) => g.id === tab)?.items ?? [];
  const pick = (e: string) => {
    onChange(e);
    setOpen(false);
    setQuery("");
  };

  if (!canEdit) return emoji ? <span className="text-large-title-regular leading-none" aria-hidden>{emoji}</span> : null;

  return (
    <>
      <button
        ref={trigger}
        type="button"
        aria-label={emoji ? `Page icon ${emoji}. Change icon` : "Add an icon"}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className={cx(
          "flex shrink-0 cursor-pointer items-center justify-center rounded-xl outline-none transition-colors focus-visible:ring-2 focus-visible:ring-border-focus-ring",
          emoji
            ? "size-11 text-large-title-regular hover:bg-background-secondary-hover"
            : "h-7 gap-1 px-2 text-body-2-medium text-text-tertiary opacity-0 hover:bg-background-secondary-hover hover:text-text-secondary group-hover/title:opacity-100 focus-visible:opacity-100 max-lg:opacity-100",
        )}
      >
        {emoji || (
          <>
            <RiEmotionLine className="size-4" aria-hidden />
            Add icon
          </>
        )}
      </button>
      <AriaPopover triggerRef={trigger} isOpen={open} onOpenChange={setOpen} placement="bottom start" offset={6} className={cx(MENU_POPOVER_SURFACE, "w-[22rem]")}>
        <AriaDialog aria-label="Page icon" className="flex flex-col gap-2 outline-none">
          <div className="flex items-center gap-2">
            <Input
              aria-label="Search emoji"
              placeholder="Search: house, keys, travel…"
              leadingIcon={RiSearchLine}
              value={query}
              autoFocus
              className="flex-1"
              onChange={(v) => {
                // A pasted or typed emoji (⌃⌘Space, Win+.) is used as it is.
                const g = firstGrapheme(v);
                if (g && /\p{Extended_Pictographic}/u.test(g)) return pick(g);
                setQuery(v);
              }}
            />
            {emoji ? (
              <Button size="small" variant="secondary" onClick={() => pick("")}>
                Remove
              </Button>
            ) : null}
          </div>
          {results ? null : (
            <div role="tablist" aria-label="Emoji groups" className="flex flex-wrap gap-1">
              {GROUPS.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === g.id}
                  onClick={() => setTab(g.id)}
                  className={cx(
                    "shrink-0 cursor-pointer rounded-full px-2.5 py-1 text-body-2-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-border-focus-ring max-sm:min-h-9",
                    tab === g.id ? "bg-pill-tab-blue-selected-background text-text-primary" : "text-text-secondary hover:bg-background-secondary-hover",
                  )}
                >
                  {g.label}
                </button>
              ))}
            </div>
          )}
          <div className="max-h-64 overflow-y-auto">
            {shown.length ? (
              <EmojiGrid items={shown} selected={emoji} onPick={pick} />
            ) : (
              <p className="px-1 py-3 text-center text-body-2-regular text-text-secondary">Nothing for “{query}”. Try another word, or paste any emoji.</p>
            )}
          </div>
        </AriaDialog>
      </AriaPopover>
    </>
  );
}
