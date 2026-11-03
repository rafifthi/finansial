import { CHIP_COLORS, type ChipColor } from "@/components/base/badges/chip";
import { cx } from "@/utils/cx";

/** Colours a category can pick; stored by name in Categories.color. */
export const CATEGORY_COLORS = [
  { id: "blue", label: "Blue" },
  { id: "cyan", label: "Cyan" },
  { id: "lime", label: "Green" },
  { id: "yellow", label: "Yellow" },
  { id: "orange", label: "Orange" },
  { id: "rose", label: "Red" },
  { id: "purple", label: "Purple" },
  { id: "neutral", label: "Gray" },
] as const satisfies readonly { id: ChipColor; label: string }[];

/** Colour a category gets until one is picked. */
export const GROUP_COLOR: Record<string, ChipColor> = {
  Needs: "blue",
  Wants: "orange",
  Savings: "purple",
  Income: "lime",
};

// Names written by earlier versions (and hand-edited sheets).
const ALIASES: Record<string, ChipColor> = { pink: "rose", red: "rose", violet: "purple", green: "lime", gray: "neutral", grey: "neutral" };
const KNOWN = new Set<string>(CATEGORY_COLORS.map((c) => c.id));

export function categoryColor(c: { color?: string; group?: string }): ChipColor {
  const name = (c.color ?? "").trim().toLowerCase();
  if (KNOWN.has(name)) return name as ChipColor;
  return ALIASES[name] ?? GROUP_COLOR[c.group ?? ""] ?? "neutral";
}

/** A few starting points for the emoji field; any emoji can be typed. */
export const EMOJI_SUGGESTIONS = ["🛒", "🍜", "☕", "🚗", "🧾", "🏠", "💊", "👶", "🎉", "🛍️", "📺", "✈️", "🎁", "🐷", "🚨", "💼"];

/** First grapheme only, so a pasted word or several emoji stay one glyph. */
export function firstGrapheme(value: string): string {
  const s = value.trim();
  if (!s) return "";
  const seg = new Intl.Segmenter(undefined, { granularity: "grapheme" });
  return seg.segment(s)[Symbol.iterator]().next().value?.segment ?? "";
}

const SIZES = {
  sm: { box: "size-7 rounded-lg", emoji: "text-body-regular", letter: "text-caption-1-medium" },
  md: { box: "size-9 rounded-xl", emoji: "text-headline-regular", letter: "text-body-medium" },
  lg: { box: "size-12 rounded-2xl", emoji: "text-title-2-regular", letter: "text-headline-medium" },
};

/**
 * A category's identity: its emoji on its colour. Without an emoji the name's
 * first letter stands in, so every category still reads at a glance.
 */
export function CategoryIcon({
  name,
  emoji,
  color,
  group,
  size = "md",
  className,
}: {
  name: string;
  emoji?: string;
  color?: string;
  group?: string;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const s = SIZES[size];
  const glyph = emoji?.trim();
  return (
    <span
      aria-hidden
      className={cx(
        "inline-flex shrink-0 items-center justify-center select-none",
        s.box,
        CHIP_COLORS[categoryColor({ color, group })],
        glyph ? s.emoji : s.letter,
        className,
      )}
    >
      {glyph || (name.trim()[0] ?? "?").toUpperCase()}
    </span>
  );
}
