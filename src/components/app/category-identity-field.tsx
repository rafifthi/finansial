"use client";

import { useState } from "react";
import { RiCheckLine, RiSearchLine } from "@remixicon/react";
import { Radio as AriaRadio, RadioGroup as AriaRadioGroup } from "react-aria-components";
import { CHIP_COLORS } from "@/components/base/badges/chip";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { Label } from "@/components/base/input/label";
import { EMOJI_GROUPS, searchEmoji, suggestEmoji } from "@/lib/emoji-catalog";
import { cx } from "@/utils/cx";
import { CATEGORY_COLORS, CategoryIcon, categoryColor, firstGrapheme } from "./category-icon";

/** Emoji + colour picker for a category, with a live preview of the tile. */
export function CategoryIdentityField({
  name,
  group,
  emoji,
  color,
  onChange,
}: {
  name: string;
  group: string;
  emoji: string;
  color: string;
  onChange: (patch: { emoji?: string; color?: string }) => void;
}) {
  const selectedColor = categoryColor({ color, group });
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState(EMOJI_GROUPS[0].id);
  const suggested = suggestEmoji(name);
  const results = query.trim() ? searchEmoji(query) : null;
  const shown = results ?? EMOJI_GROUPS.find((g) => g.id === tab)?.items.map(([e]) => e) ?? [];
  const pick = (e: string) => onChange({ emoji: emoji === e ? "" : e });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <CategoryIcon name={name || "?"} emoji={emoji} color={color} group={group} size="lg" />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-body-medium text-text-primary">Emoji</span>
          <span className="text-body-2-regular text-text-secondary">
            {emoji ? "Pick another, or remove it to show the first letter." : "Pick one below. Without one, the first letter is shown."}
          </span>
        </div>
        {emoji ? (
          <Button size="small" variant="ghost" onClick={() => onChange({ emoji: "" })}>
            Remove
          </Button>
        ) : null}
      </div>

      {suggested.length ? (
        <div className="flex flex-col gap-1.5">
          <span className="text-caption-1-medium text-text-secondary">Suggested for {name}</span>
          <EmojiGrid items={suggested} selected={emoji} onPick={pick} />
        </div>
      ) : null}

      <div className="flex flex-col gap-2 rounded-2xl border border-border-button-default p-2">
        <Input
          aria-label="Search emoji"
          placeholder="Search: makan, bensin, gaji, travel…"
          leadingIcon={RiSearchLine}
          value={query}
          onChange={(v) => {
            // A pasted or typed emoji (e.g. from ⌃⌘Space) is used as it is.
            const g = firstGrapheme(v);
            if (g && /\p{Extended_Pictographic}/u.test(g)) {
              onChange({ emoji: g });
              setQuery("");
              return;
            }
            setQuery(v);
          }}
        />
        {results ? null : (
          <div role="tablist" aria-label="Emoji groups" className="flex flex-wrap gap-1">
            {EMOJI_GROUPS.map((g) => (
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
        {shown.length ? (
          <EmojiGrid items={shown} selected={emoji} onPick={pick} />
        ) : (
          <p className="px-1 py-3 text-center text-body-2-regular text-text-secondary">
            Nothing for “{query}”. Try another word, or press ⌃⌘Space (Mac) or Win+. (Windows) and pick any emoji.
          </p>
        )}
      </div>

      <AriaRadioGroup
        value={selectedColor}
        onChange={(v) => onChange({ color: v })}
        orientation="horizontal"
        className="flex flex-col gap-1.5"
      >
        <Label>Colour</Label>
        <div className="flex flex-wrap gap-2">
          {CATEGORY_COLORS.map((c) => (
            <AriaRadio
              key={c.id}
              value={c.id}
              aria-label={c.label}
              className={({ isFocusVisible, isSelected }) =>
                cx(
                  "flex size-8 cursor-pointer items-center justify-center rounded-full border border-border-button-default outline-none",
                  CHIP_COLORS[c.id],
                  isSelected && "ring-2 ring-accent-500",
                  isFocusVisible && "ring-2 ring-border-focus-ring",
                )
              }
            >
              {({ isSelected }) => (isSelected ? <RiCheckLine className="size-4" aria-hidden /> : null)}
            </AriaRadio>
          ))}
        </div>
      </AriaRadioGroup>
    </div>
  );
}

export function EmojiGrid({ items, selected, onPick }: { items: string[]; selected: string; onPick: (e: string) => void }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(2.75rem,1fr))] gap-1">
      {items.map((e) => (
        <button
          key={e}
          type="button"
          aria-label={`Use ${e}`}
          aria-pressed={selected === e}
          onClick={() => onPick(e)}
          className={cx(
            "flex h-11 cursor-pointer items-center justify-center rounded-xl text-title-2-regular outline-none transition-[background-color,transform] duration-150 ease-out hover:bg-background-secondary-hover focus-visible:ring-2 focus-visible:ring-border-focus-ring active:scale-95",
            selected === e && "bg-pill-tab-blue-selected-background ring-2 ring-border-focus-ring",
          )}
        >
          {e}
        </button>
      ))}
    </div>
  );
}
