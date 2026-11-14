"use client";

import { useMemo } from "react";
import { RiCalendarScheduleLine, RiHistoryLine } from "@remixicon/react";
import { ComboBox, ComboBoxItem } from "@/components/base/combobox/combobox";
import type { FormOptions } from "@/lib/data/app-data";
import { normalizeName } from "@/lib/finance/installments";
import { formatMoney } from "@/lib/finance/money";

type Installment = FormOptions["installments"][number];
type Past = FormOptions["descriptions"][number];

export type DescriptionPick = { kind: "installment"; installment: Installment } | { kind: "past"; past: Past };

interface Item {
  id: string;
  text: string;
  pick: DescriptionPick;
  hint: string;
}

const MAX = 8;

/**
 * Description with suggestions: active installments (by name) and what was
 * written before for this kind of entry, most used first. Typing anything else
 * is fine; picking a suggestion also lets the form fill in the rest.
 */
export function DescriptionField({
  value,
  onChange,
  onPick,
  options,
  type,
  placeholder,
  error,
}: {
  value: string;
  onChange: (text: string) => void;
  onPick: (pick: DescriptionPick) => void;
  options: FormOptions;
  type: Past["type"];
  placeholder?: string;
  error?: string;
}) {
  const items = useMemo(() => {
    const fmt = (n: number) => formatMoney(n, options.money);
    const categoryName = (id: string) => options.categories.find((c) => c.id === id)?.name;
    const q = normalizeName(value);
    // Starts-with first, then contains; nothing typed shows the most used.
    const rank = (text: string) => {
      if (!q) return 1;
      const t = normalizeName(text);
      if (t === q) return -1; // already typed in full: no point suggesting it
      return t.startsWith(q) ? 0 : t.includes(q) ? 1 : -1;
    };
    const out: (Item & { r: number })[] = [];
    if (type === "expense") {
      for (const i of options.installments) {
        if (i.isComplete) continue;
        const r = rank(i.name);
        if (r < 0) continue;
        out.push({
          id: `i:${i.id}`,
          text: i.name,
          pick: { kind: "installment", installment: i },
          hint: `Installment · ${fmt(i.monthly_amount)}/mo · payment ${i.nextStep} of ${i.tenor_months}`,
          r: r - 0.5, // installments ahead of plain history at the same rank
        });
      }
    }
    const names = new Set(out.map((o) => normalizeName(o.text)));
    for (const p of options.descriptions) {
      if (p.type !== type || names.has(normalizeName(p.text))) continue;
      const r = rank(p.text);
      if (r < 0) continue;
      const where =
        p.type === "transfer"
          ? [categoryName(p.from_category_id), categoryName(p.category_id)].filter(Boolean).join(" → ")
          : categoryName(p.category_id);
      out.push({
        id: `p:${p.type}:${p.text}`,
        text: p.text,
        pick: { kind: "past", past: p },
        hint: [where, `${p.count}× · last ${fmt(p.amount)}`].filter(Boolean).join(" · "),
        r,
      });
      if (out.length > MAX * 4) break;
    }
    return out.sort((a, b) => a.r - b.r).slice(0, MAX);
  }, [value, type, options]);

  return (
    <ComboBox
      label="Description"
      isRequired
      placeholder={placeholder}
      inputValue={value}
      onInputChange={onChange}
      allowsCustomValue
      allowsEmptyCollection={false}
      menuTrigger="focus"
      items={items}
      onSelectionChange={(key) => {
        const item = items.find((i) => i.id === key);
        if (item) onPick(item.pick);
      }}
      isInvalid={Boolean(error)}
      hint={error}
      aria-label="Description"
    >
      {(item: Item) => (
        <ComboBoxItem id={item.id} textValue={item.text}>
          {item.pick.kind === "installment" ? (
            <RiCalendarScheduleLine className="size-4 shrink-0 text-foreground-icon-secondary" aria-hidden />
          ) : (
            <RiHistoryLine className="size-4 shrink-0 text-foreground-icon-tertiary" aria-hidden />
          )}
          <span className="flex min-w-0 flex-col">
            <span className="truncate">{item.text}</span>
            <span className="truncate text-caption-1-regular text-text-tertiary">{item.hint}</span>
          </span>
        </ComboBoxItem>
      )}
    </ComboBox>
  );
}
