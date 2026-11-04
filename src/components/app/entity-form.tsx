"use client";

import { useState, useTransition } from "react";
import { RiAddLine, RiDeleteBinLine, RiPencilLine } from "@remixicon/react";
import { deleteEntity, saveEntity } from "@/actions/entities";
import { Button } from "@/components/base/buttons/button";
import { IconButton } from "@/components/base/buttons/icon-button";
import { Checkbox } from "@/components/base/checkbox/checkbox";
import { Input } from "@/components/base/input/input";
import { NumberField } from "@/components/base/number-field/number-field";
import { toast } from "@/components/base/toast/toast";
import { TABLE_PERMISSION } from "@/lib/auth/roles";
import type { MoneyFormat } from "@/lib/finance/money";
import { DateField, MoneyField, SelectField, type Option } from "./fields";
import { DrawerForm, FormDrawer, FormError } from "./form-drawer";
import { useBookId, useCan } from "./permissions";

export type EntityTable = "accounts" | "categories" | "goals" | "installments" | "recurring";

export type FieldSpec =
  | { name: string; label: string; type: "text"; placeholder?: string; required?: boolean }
  | { name: string; label: string; type: "money" }
  | { name: string; label: string; type: "number"; min?: number; max?: number; hint?: string }
  | { name: string; label: string; type: "date" }
  | { name: string; label: string; type: "month" }
  | { name: string; label: string; type: "select"; options: Option[]; allowEmpty?: string; searchable?: boolean }
  | { name: string; label: string; type: "checkbox" };

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
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const set = (name: string, value: unknown) => setValues((v) => ({ ...v, [name]: value }));

  const submit = () =>
    startTransition(async () => {
      setError(null);
      const res = await saveEntity(bookId, { table, values });
      if (!res.ok) return setError(res.error);
      toast("Saved", { status: "success" });
      onDone();
    });

  const destroy = () =>
    startTransition(async () => {
      const res = await deleteEntity(bookId, { table, id: String(values.id) });
      if (!res.ok) return setError(res.error);
      toast("Deleted", { status: "success" });
      onDone();
    });

  return (
    <DrawerForm
      title={title}
      onSubmit={submit}
      footer={
        <>
          {canDelete ? (
            <Button type="button" variant="danger" leadingIcon={RiDeleteBinLine} onClick={onDelete ?? destroy} disabled={pending}>
              Delete
            </Button>
          ) : (
            <span className="hidden sm:block" />
          )}
          <Button type="submit" variant="primary" disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </Button>
        </>
      }
    >
        {fields.map((f) => {
          const v = values[f.name];
          switch (f.type) {
            case "text":
              return (
                <Input
                  key={f.name}
                  label={f.label}
                  value={String(v ?? "")}
                  onChange={(x) => set(f.name, x)}
                  placeholder={f.placeholder}
                  isRequired={f.required}
                />
              );
            case "money":
              return <MoneyField key={f.name} label={f.label} value={typeof v === "number" ? v : null} onChange={(x) => set(f.name, x ?? 0)} money={money} />;
            case "number":
              return (
                <NumberField
                  key={f.name}
                  label={f.label}
                  hint={f.hint}
                  value={typeof v === "number" ? v : Number.NaN}
                  onChange={(x) => set(f.name, Number.isNaN(x) ? undefined : x)}
                  minValue={f.min}
                  maxValue={f.max}
                />
              );
            case "date":
              return <DateField key={f.name} label={f.label} value={String(v ?? "")} onChange={(x) => set(f.name, x)} />;
            case "month":
              return (
                <Input
                  key={f.name}
                  label={f.label}
                  type="month"
                  value={String(v ?? "")}
                  onChange={(x) => set(f.name, x)}
                />
              );
            case "select":
              return (
                <SelectField
                  key={f.name}
                  label={f.label}
                  value={String(v ?? "")}
                  onChange={(x) => set(f.name, x)}
                  options={f.options}
                  allowEmpty={f.allowEmpty}
                  searchable={f.searchable}
                />
              );
            case "checkbox":
              return (
                <Checkbox key={f.name} isSelected={Boolean(v)} onChange={(x) => set(f.name, x)}>
                  {f.label}
                </Checkbox>
              );
          }
        })}
        <FormError>{error}</FormError>
    </DrawerForm>
  );
}
