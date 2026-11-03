"use client";

import { parseDate, type CalendarDate } from "@internationalized/date";
import type { ReactNode } from "react";
import { I18nProvider } from "react-aria-components";
import { DatePicker } from "@/components/base/date-picker/date-picker";
import { Label } from "@/components/base/input/label";
import { NumberField } from "@/components/base/number-field/number-field";
import { Select, SelectItem } from "@/components/base/select/select";
import type { MoneyFormat } from "@/lib/finance/money";
import { cx } from "@/utils/cx";

export interface Option {
  id: string;
  label: string;
}

/** Controlled single select over plain options; `""` means nothing chosen. */
export function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder = "Select…",
  allowEmpty,
  className,
  size,
}: {
  label?: ReactNode;
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  /** Adds a first "none" option that clears the value. */
  allowEmpty?: string;
  className?: string;
  size?: "sm" | "md";
}) {
  const items = allowEmpty ? [{ id: "__none", label: allowEmpty }, ...options] : options;
  return (
    <Select
      label={label}
      aria-label={typeof label === "string" ? label : placeholder}
      placeholder={placeholder}
      selectedKey={value || (allowEmpty ? "__none" : null)}
      onSelectionChange={(k) => onChange(k === "__none" || k == null ? "" : String(k))}
      className={cx("w-full", className)}
      triggerClassName="w-full"
      size={size}
    >
      {items.map((o) => (
        <SelectItem key={o.id} id={o.id} textValue={o.label}>
          {o.label}
        </SelectItem>
      ))}
    </Select>
  );
}

export function MoneyField({
  label,
  value,
  onChange,
  money,
  className,
  autoFocus,
}: {
  label?: ReactNode;
  value: number | null;
  onChange: (value: number | null) => void;
  money: MoneyFormat;
  className?: string;
  autoFocus?: boolean;
}) {
  return (
    <I18nProvider locale={money.locale}>
      <NumberField
        label={label}
        aria-label={typeof label === "string" ? label : "Amount"}
        value={value ?? Number.NaN}
        onChange={(v) => onChange(Number.isNaN(v) ? null : v)}
        minValue={0}
        hideSteppers
        autoFocus={autoFocus}
        formatOptions={{
          style: "currency",
          currency: money.currency,
          maximumFractionDigits: money.currency === "IDR" ? 0 : 2,
        }}
        className={className}
      />
    </I18nProvider>
  );
}

export function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  let parsed: CalendarDate | null = null;
  try {
    parsed = value ? parseDate(value) : null;
  } catch {
    parsed = null;
  }
  return (
    <div className="flex flex-col gap-1">
      <Label>{label}</Label>
      <DatePicker aria-label={label} value={parsed} onChange={(d) => onChange(d ? d.toString() : "")} />
    </div>
  );
}
