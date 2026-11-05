"use client";

import { useState, useTransition } from "react";
import { RiDeleteBinLine, RiEqualizerLine } from "@remixicon/react";
import { deleteAdjustment, restoreAdjustment, saveAdjustment } from "@/actions/savings";
import { Button } from "@/components/base/buttons/button";
import { IconButton } from "@/components/base/buttons/icon-button";
import { Input } from "@/components/base/input/input";
import { SegmentedControl, SegmentedControlItem } from "@/components/base/segmented-control/segmented-control";
import { toast } from "@/components/base/toast/toast";
import { formatMoney, type MoneyFormat } from "@/lib/finance/money";
import { cx } from "@/utils/cx";
import { DateField, MoneyField } from "./fields";
import { DrawerForm, FormDrawer, summarizeErrors } from "./form-drawer";
import { useBookId } from "./permissions";
import { undoToast } from "./undo";

type Mode = "match" | "add" | "subtract";
type Errors = Partial<Record<"amount" | "date" | "note", string>>;

/**
 * Corrects a pot's balance without a transaction: either type what the bank
 * shows and the difference is booked, or add or take a fixed amount.
 */
export function AdjustBalanceButton({
  potId,
  potName,
  balance,
  money,
  today,
}: {
  potId: string;
  potName: string;
  balance: number;
  money: MoneyFormat;
  today: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" leadingIcon={RiEqualizerLine} onClick={() => setOpen(true)}>
        Adjust balance
      </Button>
      <FormDrawer isOpen={open} onOpenChange={setOpen} aria-label="Adjust balance">
        <AdjustForm potId={potId} potName={potName} balance={balance} money={money} today={today} onDone={() => setOpen(false)} />
      </FormDrawer>
    </>
  );
}

function AdjustForm({
  potId,
  potName,
  balance,
  money,
  today,
  onDone,
}: {
  potId: string;
  potName: string;
  balance: number;
  money: MoneyFormat;
  today: string;
  onDone: () => void;
}) {
  const bookId = useBookId();
  const fmt = (n: number) => formatMoney(n, money);
  const [mode, setMode] = useState<Mode>("match");
  const [value, setValue] = useState<number | null>(null);
  const [date, setDate] = useState(today);
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // The signed change to the pot.
  const delta = value === null ? null : mode === "match" ? value - balance : mode === "add" ? value : -value;

  function submit() {
    const found: Errors = {};
    if (value === null) found.amount = mode === "match" ? "Enter the actual balance" : "Enter an amount";
    else if (!delta) found.amount = mode === "match" ? "That's already the balance" : "Enter an amount";
    if (!date) found.date = "Pick a date";
    if (!note.trim()) found.note = "Say what it's for";
    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length || delta === null) return;
    startTransition(async () => {
      const res = await saveAdjustment(bookId, { category_id: potId, date, amount: delta, note: note.trim() });
      if (!res.ok) {
        setErrors((res.fieldErrors ?? {}) as Errors);
        return setFormError(res.fieldErrors ? null : res.error);
      }
      toast(`${potName} ${delta > 0 ? "+" : "−"}${fmt(Math.abs(delta))}`, { status: "success", description: `Balance now ${fmt(balance + delta)}` });
      onDone();
    });
  }

  return (
    <DrawerForm
      title="Adjust balance"
      description={`${potName} · now ${fmt(balance)}. For interest, fees or a miscount: no transaction is written and budgets don't change.`}
      onSubmit={submit}
      error={summarizeErrors(errors) ?? formError}
      footer={
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Saving…" : "Save adjustment"}
        </Button>
      }
    >
      <SegmentedControl
        aria-label="Kind of adjustment"
        className="w-full [&>*]:flex-1"
        selectedKeys={[mode]}
        onSelectionChange={(keys) => {
          const next = [...keys][0] as Mode | undefined;
          if (next && next !== mode) {
            setMode(next);
            setValue(null);
            setErrors({});
          }
        }}
      >
        <SegmentedControlItem id="match">Match actual</SegmentedControlItem>
        <SegmentedControlItem id="add">Add</SegmentedControlItem>
        <SegmentedControlItem id="subtract">Subtract</SegmentedControlItem>
      </SegmentedControl>

      <MoneyField
        label={mode === "match" ? "Actual balance" : "Amount"}
        hint={mode === "match" ? "What the bank or app shows for this pot right now." : undefined}
        value={value}
        onChange={(v) => {
          setValue(v);
          setErrors((e) => ({ ...e, amount: undefined }));
        }}
        money={money}
        autoFocus
        isRequired
        error={errors.amount}
        fieldClassName="px-2.5 py-2"
        inputClassName="field-display text-title-1-semibold"
      />

      {delta ? (
        <div className="flex items-center justify-between gap-3 rounded-xl bg-background-secondary-default px-3 py-2.5" aria-live="polite">
          <span className="text-body-2-regular text-text-secondary">
            {fmt(balance)} → {fmt(balance + delta)}
          </span>
          <span className={cx("text-body-medium tabular-nums", delta > 0 ? "text-text-primary" : "text-text-error-primary")}>
            {delta > 0 ? "+" : "−"}
            {fmt(Math.abs(delta))}
          </span>
        </div>
      ) : null}

      <DateField label="Date" value={date} onChange={(v) => setDate(v)} error={errors.date} isRequired />

      <Input
        label="Note"
        isRequired
        value={note}
        onChange={(v) => {
          setNote(v);
          setErrors((e) => ({ ...e, note: undefined }));
        }}
        placeholder="e.g. Bunga Oktober"
        isInvalid={Boolean(errors.note)}
        errorMessage={errors.note}
        maxLength={200}
      />
    </DrawerForm>
  );
}

/** Removes an adjustment, with Undo. */
export function DeleteAdjustmentButton({ id, label }: { id: string; label: string }) {
  const bookId = useBookId();
  const [pending, startTransition] = useTransition();
  return (
    <IconButton
      icon={RiDeleteBinLine}
      size="small"
      aria-label={`Delete adjustment ${label}`}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await deleteAdjustment(bookId, { id });
          if (!res.ok) return void toast("Couldn't delete", { status: "error", description: res.error });
          const row = res.data;
          undoToast(`Deleted adjustment ${label}`, () => (row ? restoreAdjustment(bookId, { row }) : Promise.resolve({ ok: true })));
        })
      }
    />
  );
}
