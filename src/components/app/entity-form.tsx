"use client";

import { useState, useTransition } from "react";
import { RiAddLine, RiDeleteBinLine, RiPencilLine } from "@remixicon/react";
import { deleteEntity, restoreEntity, saveEntity } from "@/actions/entities";
import { Button } from "@/components/base/buttons/button";
import { IconButton } from "@/components/base/buttons/icon-button";
import { Checkbox } from "@/components/base/checkbox/checkbox";
import { Input } from "@/components/base/input/input";
import { NumberField } from "@/components/base/number-field/number-field";
import { SegmentedControl, SegmentedControlItem } from "@/components/base/segmented-control/segmented-control";
import { toast } from "@/components/base/toast/toast";
import { TABLE_PERMISSION } from "@/lib/auth/roles";
import { formatMoney, type MoneyFormat } from "@/lib/finance/money";
import { ordinal } from "@/lib/ordinal";
import { CategoryIdentityField } from "./category-identity-field";
import { DateField, MoneyField, MonthField, SelectField, type Option } from "./fields";
import { InstitutionField } from "./institution-field";
import { DrawerForm, FormDrawer, summarizeErrors } from "./form-drawer";
import { undoToast } from "./undo";
import { useBookId, useCan } from "./permissions";

export type EntityTable = "accounts" | "categories" | "goals" | "installments" | "recurring";

/** Show (or require) a field only while another field holds one of these values. */
export interface FieldWhen {
  field: string;
  in: string[];
}

interface Base {
  name: string;
  label: string;
  hint?: string;
  showWhen?: FieldWhen;
  required?: boolean;
  requiredWhen?: FieldWhen;
}

export type FieldSpec =
  | (Base & { type: "text"; placeholder?: string })
  | (Base & { type: "money" })
  | (Base & { type: "number"; min?: number; max?: number })
  | (Base & { type: "date" })
  | (Base & { type: "month" })
  | (Base & { type: "select"; options: Option[]; allowEmpty?: string; searchable?: boolean })
  /** A short choice shown all at once (2–4 options). */
  | (Base & { type: "segmented"; options: Option[] })
  | (Base & { type: "checkbox" })
  /** Category emoji + colour (writes the `emoji` and `color` columns). */
  | (Base & { type: "identity" })
  /** Account's bank or app, searchable, with logos. */
  | (Base & { type: "institution" })
  /** Recurring "Repeats" + "On": writes `frequency` and `day`. */
  | (Base & { type: "schedule" })
  /** A section heading between groups of fields. */
  | (Base & { type: "heading" })
  /** A plain-language sentence of what a recurring rule will do. */
  | (Base & { type: "recurring-preview"; categories: Option[]; accounts: Option[] });

type Values = Record<string, unknown>;

/**
 * Button that opens a modal form for one row of an editable table. With
 * `initial.id` it edits (and can delete); without, it creates.
 */
export function EntityFormButton({
  table,
  title,
  fields,
  initial = {},
  money,
  trigger = "button",
  label,
  canDelete = true,
  onDelete,
}: {
  table: EntityTable;
  title: string;
  fields: FieldSpec[];
  initial?: Values;
  money: MoneyFormat;
  trigger?: "button" | "icon";
  label?: string;
  canDelete?: boolean;
  /** Replaces the plain delete with a custom flow (e.g. a confirm dialog); the drawer closes first. */
  onDelete?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const isEdit = Boolean(initial.id);
  if (!useCan(TABLE_PERMISSION[table])) return null;
  return (
    <>
      {trigger === "icon" ? (
        <IconButton size="small" icon={RiPencilLine} aria-label={label ?? `Edit ${title}`} onClick={() => setOpen(true)} />
      ) : (
        <Button variant={isEdit ? "secondary" : "primary"} leadingIcon={isEdit ? RiPencilLine : RiAddLine} onClick={() => setOpen(true)}>
          {label ?? (isEdit ? "Edit" : `New ${title.toLowerCase()}`)}
        </Button>
      )}
      <FormDrawer isOpen={open} onOpenChange={setOpen} aria-label={title}>
        <EntityFormBody
          table={table}
          title={isEdit ? `Edit ${title.toLowerCase()}` : `New ${title.toLowerCase()}`}
          fields={fields}
          initial={initial}
          money={money}
          canDelete={isEdit && canDelete}
          onDelete={
            onDelete &&
            (() => {
              setOpen(false);
              onDelete();
            })
          }
          onDone={() => setOpen(false)}
        />
      </FormDrawer>
    </>
  );
}

function EntityFormBody({
  table,
  title,
  fields,
  initial,
  money,
  canDelete,
  onDelete,
  onDone,
}: {
  table: EntityTable;
  title: string;
  fields: FieldSpec[];
  initial: Values;
  money: MoneyFormat;
  canDelete: boolean;
  onDelete?: () => void;
  onDone: () => void;
}) {
  const bookId = useBookId();
  const [values, setValues] = useState<Values>(initial);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const set = (name: string, value: unknown) => {
    setValues((v) => ({ ...v, [name]: value }));
    setErrors((e) => (e[name] ? { ...e, [name]: undefined } : e));
  };
  const visible = fields.filter((f) => matches(f.showWhen, values));
  const itemName = String(values.name || values.description || "").trim();

  function validate() {
    const found: Record<string, string> = {};
    for (const f of visible) {
      const required = f.required || (f.requiredWhen ? matches(f.requiredWhen, values) : false);
      if (required && isEmpty(values[f.name])) found[f.name] = requiredMessage(f);
    }
    return found;
  }

  const submit = () => {
    setFormError(null);
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length) return;
    startTransition(async () => {
      const res = await saveEntity(bookId, { table, values });
      if (!res.ok) {
        // Server messages are keyed by column; show each next to its field.
        setErrors(res.fieldErrors ?? {});
        return setFormError(res.fieldErrors ? null : res.error);
      }
      toast(itemName ? `Saved ${itemName}` : "Saved", { status: "success" });
      onDone();
    });
  };

  const destroy = () =>
    startTransition(async () => {
      const res = await deleteEntity(bookId, { table, id: String(values.id) });
      if (!res.ok) return setFormError(res.error);
      const row = res.data;
      if (row) undoToast(`Deleted ${itemName || title.replace(/^Edit /, "")}`, () => restoreEntity(bookId, { table, row }));
      else toast("Deleted", { status: "success" });
      onDone();
    });

  return (
    <DrawerForm
      title={title}
      onSubmit={submit}
      error={summarizeErrors(errors) ?? formError}
      destructive={
        canDelete ? (
          <Button type="button" variant="ghost" leadingIcon={RiDeleteBinLine} onClick={onDelete ?? destroy} disabled={pending} className="bg-transparent text-text-error-primary hover:bg-background-tertiary-error active:bg-background-tertiary-error">
            Delete
          </Button>
        ) : null
      }
      footer={
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
      }
    >
      {visible.map((f) => {
        const v = values[f.name];
        const error = errors[f.name];
        const isRequired = f.required || (f.requiredWhen ? matches(f.requiredWhen, values) : false);
        switch (f.type) {
          case "heading":
            return (
              <h3 key={f.name} className="-mb-1 pt-2 text-headline-semibold text-text-primary first:pt-0">
                {f.label}
              </h3>
            );
          case "text":
            return (
              <Input
                key={f.name}
                label={f.label}
                hint={f.hint}
                value={String(v ?? "")}
                onChange={(x) => set(f.name, x)}
                placeholder={f.placeholder}
                isRequired={isRequired}
                isInvalid={Boolean(error)}
                errorMessage={error}
              />
            );
          case "money":
            return (
              <MoneyField
                key={f.name}
                label={f.label}
                hint={f.hint}
                value={typeof v === "number" ? v : null}
                onChange={(x) => set(f.name, x ?? (isRequired ? undefined : 0))}
                money={money}
                isRequired={isRequired}
                error={error}
              />
            );
          case "number":
            return (
              <NumberField
                key={f.name}
                label={f.label}
                hint={error ?? f.hint}
                isInvalid={Boolean(error)}
                isRequired={isRequired}
                isWheelDisabled
                value={typeof v === "number" ? v : Number.NaN}
                onChange={(x) => set(f.name, Number.isNaN(x) ? undefined : x)}
                minValue={f.min}
                maxValue={f.max}
              />
            );
          case "date":
            return <DateField key={f.name} label={f.label} hint={f.hint} value={String(v ?? "")} onChange={(x) => set(f.name, x)} isRequired={isRequired} error={error} />;
          case "month":
            return <MonthField key={f.name} label={f.label} hint={f.hint} value={String(v ?? "")} onChange={(x) => set(f.name, x)} isRequired={isRequired} error={error} />;
          case "select":
            return (
              <SelectField
                key={f.name}
                label={f.label}
                hint={f.hint}
                value={String(v ?? "")}
                onChange={(x) => set(f.name, x)}
                options={f.options}
                // A required pick has no "None": the placeholder asks for one instead.
                allowEmpty={isRequired ? undefined : f.allowEmpty}
                placeholder={`Pick ${f.label.toLowerCase()}`}
                isRequired={isRequired}
                error={error}
                searchable={f.searchable}
              />
            );
          case "segmented":
            return (
              <div key={f.name} className="flex flex-col gap-1">
                <span className="text-body-medium text-text-primary" id={`${f.name}-label`}>
                  {f.label}
                </span>
                <SegmentedControl
                  aria-labelledby={`${f.name}-label`}
                  className="w-full [&>*]:flex-1"
                  selectedKeys={[String(v ?? f.options[0]?.id ?? "")]}
                  onSelectionChange={(keys) => {
                    const next = [...keys][0];
                    if (next != null) set(f.name, String(next));
                  }}
                >
                  {f.options.map((o) => (
                    <SegmentedControlItem key={o.id} id={o.id}>
                      {o.label}
                    </SegmentedControlItem>
                  ))}
                </SegmentedControl>
              </div>
            );
          case "schedule":
            return (
              <ScheduleField
                key={f.name}
                frequency={String(values.frequency ?? "monthly")}
                day={typeof values.day === "number" ? values.day : 1}
                onChange={(patch) => setValues((x) => ({ ...x, ...patch }))}
                error={errors.day ?? errors.frequency}
              />
            );
          case "recurring-preview":
            return <RecurringPreview key={f.name} values={values} money={money} categories={f.categories} accounts={f.accounts} />;
          case "identity":
            return (
              <CategoryIdentityField
                key={f.name}
                name={String(values.name ?? "")}
                group={String(values.group ?? "")}
                emoji={String(values.emoji ?? "")}
                color={String(values.color ?? "")}
                onChange={(patch) => setValues((x) => ({ ...x, ...patch }))}
              />
            );
          case "institution":
            return (
              <InstitutionField
                key={f.name}
                label={f.label}
                name={String(values.name ?? "")}
                type={(values.type as never) ?? "bank"}
                value={String(v ?? "")}
                onChange={(x) => set(f.name, x)}
              />
            );
          case "checkbox":
            return (
              <Checkbox key={f.name} isSelected={Boolean(v)} onChange={(x) => set(f.name, x)} className="min-h-11 sm:min-h-0">
                {f.label}
              </Checkbox>
            );
        }
      })}
    </DrawerForm>
  );
}

function matches(when: FieldWhen | undefined, values: Values) {
  return !when || when.in.includes(String(values[when.field] ?? ""));
}

function isEmpty(v: unknown) {
  return v === undefined || v === null || v === "" || (typeof v === "number" && Number.isNaN(v));
}

/** "Enter a name", "Pick a category": the action that fixes it, not a schema path. */
function requiredMessage(f: FieldSpec) {
  const thing = f.label.replace(/\s*\(.*\)\s*$/, "").toLowerCase();
  switch (f.type) {
    case "text":
    case "money":
    case "number":
      return `Enter ${/^[aeiou]/.test(thing) ? "an" : "a"} ${thing}`;
    case "date":
    case "month":
      return `Pick ${/^[aeiou]/.test(thing) ? "an" : "a"} ${thing}`;
    default:
      return `Pick ${/^[aeiou]/.test(thing) ? "an" : "a"} ${thing}`;
  }
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Monthly → which day of the month; weekly → which weekday. No numbers to remember. */
function ScheduleField({
  frequency,
  day,
  onChange,
  error,
}: {
  frequency: string;
  day: number;
  onChange: (patch: { frequency: string; day: number }) => void;
  error?: string;
}) {
  const days = [
    ...Array.from({ length: 28 }, (_, i) => ({ id: String(i + 1), label: `The ${ordinal(i + 1)}` })),
    { id: "31", label: "The last day" },
  ];
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <span id="repeats-label" className="text-body-medium text-text-primary">
          Repeats
        </span>
        <SegmentedControl
          aria-labelledby="repeats-label"
          className="w-full [&>*]:flex-1"
          selectedKeys={[frequency]}
          onSelectionChange={(keys) => {
            const next = String([...keys][0] ?? "monthly");
            if (next !== frequency) onChange({ frequency: next, day: next === "weekly" ? 1 : 1 });
          }}
        >
          <SegmentedControlItem id="monthly">Monthly</SegmentedControlItem>
          <SegmentedControlItem id="weekly">Weekly</SegmentedControlItem>
        </SegmentedControl>
      </div>
      {frequency === "weekly" ? (
        <div className="flex flex-col gap-1">
          <span id="weekday-label" className="text-body-medium text-text-primary">
            On
          </span>
          <SegmentedControl
            aria-labelledby="weekday-label"
            className="w-full [&>*]:flex-1"
            selectedKeys={[String(Math.min(day, 6))]}
            onSelectionChange={(keys) => onChange({ frequency, day: Number([...keys][0] ?? 1) })}
          >
            {WEEKDAYS.map((d, i) => (
              <SegmentedControlItem key={d} id={String(i)} aria-label={WEEKDAY_NAMES[i]}>
                {d}
              </SegmentedControlItem>
            ))}
          </SegmentedControl>
        </div>
      ) : (
        <SelectField
          label="On"
          value={String(day > 28 ? 31 : Math.max(day, 1))}
          onChange={(v) => onChange({ frequency, day: Number(v) })}
          options={days}
          hint="Months without that day book on their last day."
          error={error}
        />
      )}
    </div>
  );
}

/** "Books Rp 333.000 for Billing on the 3rd of every month, from 3 Dec 2026." */
function RecurringPreview({ values, money, categories }: { values: Values; money: MoneyFormat; categories: Option[]; accounts: Option[] }) {
  const amount = typeof values.amount === "number" && values.amount > 0 ? formatMoney(values.amount, money) : null;
  const category = categories.find((c) => c.id === values.category_id)?.label;
  const from = categories.find((c) => c.id === values.from_category_id)?.label;
  const day = typeof values.day === "number" ? values.day : 1;
  const when =
    values.frequency === "weekly"
      ? `every ${WEEKDAY_NAMES[Math.min(day, 6)]}`
      : day >= 31
        ? "on the last day of every month"
        : `on the ${ordinal(day)} of every month`;
  const start = typeof values.start_date === "string" && values.start_date ? formatDay(values.start_date) : null;
  const end = typeof values.end_date === "string" && values.end_date ? formatDay(values.end_date) : null;
  if (!amount) return null;
  const what =
    values.type === "transfer"
      ? `moves ${amount}${from ? ` from ${from}` : ""}${category ? ` to ${category}` : ""}`
      : `books ${amount}${category ? ` for ${category}` : ""}`;
  return (
    <p className="rounded-xl bg-background-secondary-default px-3 py-2.5 text-body-2-regular text-text-secondary" aria-live="polite">
      This rule {what} {when}
      {start ? `, from ${start}` : ""}
      {end ? ` until ${end}` : ""}.
    </p>
  );
}

function formatDay(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(Date.UTC(y, m - 1, d)));
}
