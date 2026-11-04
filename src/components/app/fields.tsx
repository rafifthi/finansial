"use client";

import { parseDate, type CalendarDate } from "@internationalized/date";
import { useId, type ReactNode } from "react";
import { I18nProvider } from "react-aria-components";
import { ComboBox, ComboBoxItem } from "@/components/base/combobox/combobox";
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

/** The red line under an invalid field; ids let the control point at it. */
export function FieldMessage({ id, error, hint }: { id: string; error?: string | null; hint?: ReactNode }) {
  if (error) {
    return (
      <p id={id} className="pt-px text-caption-1-medium text-text-error-primary">
        {error}
      </p>
    );
  }
  return hint ? (
    <p id={id} className="pt-px text-caption-1-medium text-text-secondary">
      {hint}
    </p>
  ) : null;
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
  error,
  hint,
  invalid,
  isRequired,
  isDisabled,
  "aria-label": ariaLabel,
  searchable,
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
  error?: string | null;
  /** Error styling without a message of its own (one part of a compound field). */
  invalid?: boolean;
  hint?: ReactNode;
  isRequired?: boolean;
  isDisabled?: boolean;
  /** Accessible name when there's no visible label. */
  "aria-label"?: string;
  /** Type to filter the options (a combobox) instead of a plain picker. */
  searchable?: boolean;
}) {
  const messageId = useId();
  const items = allowEmpty ? [{ id: "__none", label: allowEmpty }, ...options] : options;
  const isInvalid = Boolean(error) || Boolean(invalid);
  if (searchable) {
    return (
      <div className={cx("flex w-full flex-col gap-1", className)}>
      <ComboBox
        label={label}
        isInvalid={isInvalid}
        isRequired={isRequired}
        aria-describedby={error || hint ? messageId : undefined}
        aria-label={ariaLabel ?? (typeof label === "string" ? label : placeholder)}
        placeholder={placeholder === "Select…" ? "Search…" : placeholder}
        menuTrigger="focus"
        selectedKey={value || (allowEmpty ? "__none" : null)}
        onSelectionChange={(k) => onChange(k === "__none" || k == null ? "" : String(k))}
        className="w-full"
        size={size === "sm" ? "small" : undefined}
      >
        {items.map((o) => (
          <ComboBoxItem key={o.id} id={o.id} textValue={o.label}>
            {o.label}
          </ComboBoxItem>
        ))}
      </ComboBox>
      <FieldMessage id={messageId} error={error} hint={hint} />
      </div>
    );
  }
  return (
    <div className={cx("flex w-full flex-col gap-1", className)}>
      <Select
        label={label}
        aria-label={ariaLabel ?? (typeof label === "string" ? label : placeholder)}
        aria-describedby={error || hint ? messageId : undefined}
        placeholder={placeholder}
        selectedKey={value || (allowEmpty ? "__none" : null)}
        onSelectionChange={(k) => onChange(k === "__none" || k == null ? "" : String(k))}
        isInvalid={isInvalid}
        isRequired={isRequired}
        isDisabled={isDisabled}
        className="w-full"
        triggerClassName={cx("w-full", isInvalid && "border-border-error-default bg-background-tertiary-error hover:border-border-error-default")}
        size={size}
      >
        {items.map((o) => (
          <SelectItem key={o.id} id={o.id} textValue={o.label}>
            {o.label}
          </SelectItem>
        ))}
      </Select>
      <FieldMessage id={messageId} error={error} hint={hint} />
    </div>
  );
}

export function MoneyField({
  label,
  value,
  onChange,
  money,
  className,
  fieldClassName,
  inputClassName,
  autoFocus,
  error,
  hint,
  isRequired,
  "aria-label": ariaLabel,
}: {
  label?: ReactNode;
  /** Accessible name when there's no visible label. */
  "aria-label"?: string;
  value: number | null;
  onChange: (value: number | null) => void;
  money: MoneyFormat;
  className?: string;
  fieldClassName?: string;
  inputClassName?: string;
  autoFocus?: boolean;
  error?: string | null;
  hint?: ReactNode;
  isRequired?: boolean;
}) {
  return (
    <I18nProvider locale={money.locale}>
      <NumberField
        label={label}
        aria-label={ariaLabel ?? (typeof label === "string" ? label : "Amount")}
        value={value ?? Number.NaN}
        onChange={(v) => onChange(Number.isNaN(v) ? null : v)}
        minValue={0}
        hideSteppers
        // A scroll or arrow key over a focused money field must never change it.
        isWheelDisabled
        autoFocus={autoFocus}
        isInvalid={Boolean(error)}
        isRequired={isRequired}
        hint={error ?? hint}
        formatOptions={{
          style: "currency",
          currency: money.currency,
          maximumFractionDigits: money.currency === "IDR" ? 0 : 2,
        }}
        className={className}
        fieldClassName={fieldClassName}
        inputClassName={inputClassName}
      />
    </I18nProvider>
  );
}

export function DateField({
  label,
  value,
  onChange,
  error,
  hint,
  isRequired,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
  hint?: ReactNode;
  isRequired?: boolean;
}) {
  const labelId = useId();
  const messageId = useId();
  let parsed: CalendarDate | null = null;
  try {
    parsed = value ? parseDate(value) : null;
  } catch {
    parsed = null;
  }
  return (
    <div className="flex flex-col gap-1">
      <Label id={labelId} isRequired={isRequired}>
        {label}
      </Label>
      <DatePicker
        aria-labelledby={labelId}
        aria-describedby={error || hint ? messageId : undefined}
        isInvalid={Boolean(error)}
        value={parsed}
        onChange={(d) => onChange(d ? d.toString() : "")}
      />
      <FieldMessage id={messageId} error={error} hint={hint} />
    </div>
  );
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * A "YYYY-MM" month as two selects. Native `type="month"` falls back to a
 * plain text box in Safari and Firefox on desktop.
 */
export function MonthField({
  label,
  value,
  onChange,
  error,
  hint,
  isRequired,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
  hint?: ReactNode;
  isRequired?: boolean;
}) {
  const labelId = useId();
  const messageId = useId();
  const [y, m] = /^\d{4}-\d{2}$/.test(value) ? value.split("-") : ["", ""];
  const thisYear = new Date().getFullYear();
  const years = Array.from({ length: 16 }, (_, i) => String(thisYear - 5 + i));
  const emit = (year: string, month: string) => onChange(year && month ? `${year}-${month}` : "");
  return (
    <div role="group" aria-labelledby={labelId} className="flex flex-col gap-1">
      <Label id={labelId} isRequired={isRequired}>
        {label}
      </Label>
      <div className="grid grid-cols-[1fr_7rem] gap-2">
        <SelectField
          aria-label={`${label}: month`}
          value={m}
          onChange={(v) => emit(y || String(thisYear), v)}
          options={MONTHS.map((name, i) => ({ id: String(i + 1).padStart(2, "0"), label: name }))}
          placeholder="Month"
          invalid={Boolean(error)}
        />
        <SelectField
          aria-label={`${label}: year`}
          value={y}
          onChange={(v) => emit(v, m || "01")}
          options={years.map((yr) => ({ id: yr, label: yr }))}
          placeholder="Year"
          invalid={Boolean(error)}
        />
      </div>
      <FieldMessage id={messageId} error={error} hint={hint} />
    </div>
  );
}
