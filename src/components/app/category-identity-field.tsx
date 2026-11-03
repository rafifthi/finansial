"use client";

import { RiCheckLine } from "@remixicon/react";
import { Radio as AriaRadio, RadioGroup as AriaRadioGroup } from "react-aria-components";
import { CHIP_COLORS } from "@/components/base/badges/chip";
import { Input } from "@/components/base/input/input";
import { Label } from "@/components/base/input/label";
import { cx } from "@/utils/cx";
import { CATEGORY_COLORS, CategoryIcon, categoryColor, EMOJI_SUGGESTIONS, firstGrapheme } from "./category-icon";

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
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-end gap-3">
        <CategoryIcon name={name || "?"} emoji={emoji} color={color} group={group} size="lg" />
        <Input
          label="Emoji"
          className="flex-1"
          value={emoji}
          onChange={(v) => onChange({ emoji: firstGrapheme(v) })}
          placeholder="Type or pick one"
          hint={emoji ? undefined : "Without one, the first letter is shown."}
        />
      </div>
      <div role="group" aria-label="Suggested emoji" className="flex flex-wrap gap-1">
        {EMOJI_SUGGESTIONS.map((e) => (
          <button
            key={e}
            type="button"
            aria-label={`Use ${e}`}
            aria-pressed={emoji === e}
            onClick={() => onChange({ emoji: emoji === e ? "" : e })}
            className={cx(
              "flex size-9 cursor-pointer items-center justify-center rounded-lg text-headline-regular outline-none hover:bg-background-secondary-hover focus-visible:ring-2 focus-visible:ring-border-focus-ring",
              emoji === e && "bg-background-tertiary-default",
            )}
          >
            {e}
          </button>
        ))}
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
