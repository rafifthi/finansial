"use client";

import { useId, useMemo, useState } from "react";
import { RiApps2Line, RiArrowUpSLine, RiSearchLine } from "@remixicon/react";
import { Input } from "@/components/base/input/input";
import { Label } from "@/components/base/input/label";
import type { FormOptions } from "@/lib/data/app-data";
import { cx } from "@/utils/cx";
import { CategoryIcon } from "./category-icon";
import { FieldMessage } from "./fields";

type Category = FormOptions["categories"][number];

const GROUP_ORDER = ["Needs", "Wants", "Savings", "Income"];
/** Tiles shown before "All"; one row of four on a phone, two rows in the drawer. */
const QUICK = 7;

/**
 * Category as tiles: the usual ones up front (by use over the last 90 days),
 * everything else one tap away, grouped and searchable. The tile is the
 * category's own identity, so it reads faster than a text list.
 */
export function CategoryPicker({
  label = "Category",
  categories,
  use,
  value,
  onChange,
  error,
}: {
  label?: string;
  categories: Category[];
  use: Record<string, number>;
  value: string;
  onChange: (id: string) => void;
  error?: string | null;
}) {
  const labelId = useId();
  const messageId = useId();
  const [all, setAll] = useState(false);
  const [query, setQuery] = useState("");

  const ranked = useMemo(
    () =>
      categories
        .map((c, i) => ({ c, i }))
        .sort((a, b) => (use[b.c.id] ?? 0) - (use[a.c.id] ?? 0) || a.i - b.i)
        .map(({ c }) => c),
    [categories, use],
  );
  const quick = ranked.slice(0, QUICK);
  // A pick from the full list stays visible after it closes.
  const selected = categories.find((c) => c.id === value);
  if (selected && !quick.includes(selected)) quick.splice(QUICK - 1, 1, selected);

  const q = query.trim().toLowerCase();
  const groups = GROUP_ORDER.map((g) => ({
    group: g,
    items: categories.filter((c) => c.group === g && (!q || c.name.toLowerCase().includes(q))),
  })).filter((g) => g.items.length > 0);

  const pick = (id: string) => {
    onChange(id);
    setAll(false);
    setQuery("");
  };

  return (
    <div className="flex flex-col gap-1.5">
      <Label id={labelId} isRequired>
        {label}
      </Label>
      {all ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-border-button-default p-3">
          <div className="flex items-center gap-2">
            <Input
              aria-label={`Search ${label.toLowerCase()}`}
              placeholder="Search categories"
              leadingIcon={RiSearchLine}
              value={query}
              onChange={setQuery}
              autoFocus
              className="flex-1"
            />
            <button
              type="button"
              onClick={() => setAll(false)}
              className="flex min-h-11 shrink-0 cursor-pointer items-center gap-1 rounded-xl px-2 text-body-medium text-text-secondary outline-none hover:bg-background-secondary-hover focus-visible:ring-2 focus-visible:ring-border-focus-ring sm:min-h-9"
            >
              <RiArrowUpSLine className="size-5" aria-hidden />
              Less
            </button>
          </div>
          {groups.length === 0 ? <p className="py-3 text-center text-body-2-regular text-text-secondary">No category called “{query}”.</p> : null}
          {groups.map(({ group, items }) => (
            <div key={group} role="radiogroup" aria-label={`${label}: ${group}`} className="flex flex-col gap-1.5">
              <span className="text-caption-1-semibold text-text-secondary">{group}</span>
              <div className="grid grid-cols-4 gap-1.5">
                {items.map((c) => (
                  <Tile key={c.id} category={c} selected={c.id === value} onPick={pick} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div role="radiogroup" aria-labelledby={labelId} aria-describedby={error ? messageId : undefined} aria-invalid={Boolean(error) || undefined} className="grid grid-cols-4 gap-1.5">
          {quick.map((c) => (
            <Tile key={c.id} category={c} selected={c.id === value} onPick={pick} />
          ))}
          {categories.length > quick.length ? (
            <button
              type="button"
              onClick={() => setAll(true)}
              className={cx(TILE, "border-dashed text-text-secondary hover:bg-background-secondary-hover")}
            >
              <RiApps2Line className="size-6 text-foreground-icon-secondary" aria-hidden />
              <span className="text-caption-1-medium">All {categories.length}</span>
            </button>
          ) : null}
        </div>
      )}
      <FieldMessage id={messageId} error={error} />
    </div>
  );
}

const TILE = [
  "flex min-h-14 min-w-0 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-border-button-default px-1 py-2",
  "outline-none transition-[background-color,border-color,box-shadow] duration-150 ease-out",
  "focus-visible:ring-2 focus-visible:ring-border-focus-ring active:scale-[0.97]",
].join(" ");

function Tile({
  category: c,
  selected,
  onPick,
}: {
  category: Category;
  selected: boolean;
  onPick: (id: string) => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={() => onPick(c.id)}
      title={`${c.name} · ${c.group}`}
      className={cx(
        TILE,
        selected
          ? "border-transparent bg-pill-tab-blue-selected-background ring-2 ring-border-focus-ring"
          : "bg-background-primary-default hover:border-border-button-hover hover:bg-background-primary-hover",
      )}
    >
      <CategoryIcon name={c.name} emoji={c.emoji} color={c.color} group={c.group} />
      <span className={cx("w-full truncate text-center text-caption-1-medium", selected ? "text-text-primary" : "text-text-secondary")}>{c.name}</span>
    </button>
  );
}
