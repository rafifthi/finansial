"use client";

import { useId, useState, useTransition } from "react";
import { parseDate, type CalendarDate } from "@internationalized/date";
import { RiAlertLine, RiArrowDownSLine, RiArrowRightLine, RiCalendarScheduleLine, RiDeleteBinLine } from "@remixicon/react";
import { deleteTransactions, restoreTransactions, saveTransaction, type TxnInput } from "@/actions/transactions";
import { Button } from "@/components/base/buttons/button";
import { Checkbox } from "@/components/base/checkbox/checkbox";
import { DatePicker } from "@/components/base/date-picker/date-picker";
import { Label } from "@/components/base/input/label";
import { SegmentedControl, SegmentedControlItem } from "@/components/base/segmented-control/segmented-control";
import { toast } from "@/components/base/toast/toast";
import type { ActionResult } from "@/lib/data/action";
import type { FormOptions } from "@/lib/data/app-data";
import { formatMoney } from "@/lib/finance/money";
import { dueDifference, matchInstallment } from "@/lib/finance/installments";
import { cx } from "@/utils/cx";
import type { Transaction } from "@/lib/sheets/schema";
import { CategoryPicker } from "./category-picker";
import { DescriptionField, type DescriptionPick } from "./description-field";
import { MoneyField, SelectField } from "./fields";
import { DrawerForm, FormDrawer, summarizeErrors } from "./form-drawer";
import { undoToast } from "./undo";
import { useBookId, useViewerMember } from "./permissions";

export type Draft = Omit<TxnInput, "amount"> & { amount: number | null };

const blank = (today: string, member: string): Draft => ({
  date: today,
  type: "expense",
  amount: null,
  category_id: "",
  from_category_id: "",
  member,
  description: "",
  verified: false,
  installment_id: "",
});

export function fromTransaction(t: Transaction): Draft {
  return {
    id: t.id,
    date: t.date,
    type: t.type,
    amount: t.amount,
    category_id: t.category_id,
    from_category_id: t.from_category_id,
    member: t.member,
    description: t.description,
    verified: t.verified,
    installment_id: t.installment_id,
  };
}

export function TransactionDrawer({
  options,
  initial,
  isOpen,
  onOpenChange,
}: {
  options: FormOptions;
  /** Existing transaction to edit; omit for a new one. */
  initial?: Draft;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <FormDrawer isOpen={isOpen} onOpenChange={onOpenChange} aria-label="Transaction">
      <TransactionFormBody options={options} initial={initial} onDone={() => onOpenChange(false)} />
    </FormDrawer>
  );
}

export function TransactionFormBody({
  options,
  initial,
  onDone,
  title,
  description,
  save,
}: {
  options: FormOptions;
  initial?: Draft;
  onDone: () => void;
  title?: string;
  description?: string;
  /** Saves a new entry some other way (e.g. a bill row records and matches it); the form stays single-entry. */
  save?: (input: TxnInput) => Promise<ActionResult<unknown>>;
}) {
  const member = useViewerMember();
  const bookId = useBookId();
  const fresh = () => blank(options.today, options.members.includes(member) ? member : "");
  const [draft, setDraft] = useState<Draft>(() => initial ?? fresh());
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const isEdit = Boolean(draft.id);
  // Extra fields start folded on a new entry; an edit opens them when one of them is in use.
  const [details, setDetails] = useState(
    Boolean(initial && (initial.installment_id || initial.verified || (initial.member && initial.member !== member))),
  );
  const [entry, setEntry] = useState(0);
  // The installment link follows the description until someone sets or clears it by hand.
  const [linkTouched, setLinkTouched] = useState(Boolean(initial?.installment_id));
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));
  };

  const kind = draft.type === "income" ? "income" : "expense";
  // Income can't be moved; a transfer runs between Needs, Wants and Savings.
  const movable = options.categories.filter((c) => c.kind === "expense");

  type FormInstallment = FormOptions["installments"][number];
  /** Links an installment and fills what's still empty: its category and the monthly due. */
  const withInstallment = (d: Draft, inst: FormInstallment | undefined): Draft => {
    if (!inst) return { ...d, installment_id: "" };
    const category = options.categories.some((c) => c.id === inst.category_id && c.kind === "expense") ? inst.category_id : "";
    return { ...d, installment_id: inst.id, category_id: d.category_id || category, amount: d.amount ?? inst.monthly_amount };
  };

  function onInstallment(id: string) {
    setLinkTouched(true);
    setDraft((d) => withInstallment(d, options.installments.find((i) => i.id === id)));
  }

  /** Typing a description that names an installment links it (expenses only). */
  function onDescription(text: string) {
    setErrors((e) => (e.description ? { ...e, description: undefined } : e));
    setDraft((d) => {
      const next = { ...d, description: text };
      if (d.type !== "expense" || linkTouched) return next;
      return withInstallment(next, matchInstallment(text, options.installments));
    });
  }

  /** A picked suggestion fills the description, then whatever is still empty. */
  function onPick(pick: DescriptionPick) {
    setErrors((e) => ({ ...e, description: undefined, category_id: undefined, from_category_id: undefined }));
    if (pick.kind === "installment") {
      setLinkTouched(false);
      setDraft((d) => withInstallment({ ...d, description: pick.installment.name }, pick.installment));
      return;
    }
    const p = pick.past;
    const known = (id: string) => (options.categories.some((c) => c.id === id) ? id : "");
    setDraft((d) => {
      const next: Draft = {
        ...d,
        description: p.text,
        category_id: d.category_id || known(p.category_id),
        from_category_id: d.type === "transfer" ? d.from_category_id || known(p.from_category_id) : d.from_category_id,
        amount: d.amount ?? p.amount,
      };
      if (d.type !== "expense" || linkTouched) return next;
      return withInstallment(next, matchInstallment(p.text, options.installments));
    });
  }

  const linked = draft.type === "expense" ? options.installments.find((i) => i.id === draft.installment_id) : undefined;
  const dueOff = linked && draft.amount ? dueDifference(draft.amount, linked) : 0;

  function validate(): Errors {
    const e: Errors = {};
    if (draft.amount === null || draft.amount <= 0) e.amount = "Enter an amount";
    if (draft.type === "transfer") {
      if (!draft.from_category_id) e.from_category_id = "Pick where the money comes from";
      if (!draft.category_id) e.category_id = "Pick where the money goes";
      else if (draft.category_id === draft.from_category_id) e.category_id = "Pick two different categories";
    } else if (!draft.category_id) e.category_id = "Pick a category";
    if (!draft.description?.trim()) e.description = "Enter a description";
    if (!draft.date) e.date = "Pick a date";
    return e;
  }

  function submit(another = false) {
    setFormError(null);
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length) return;
    startTransition(async () => {
      const input = { ...draft, amount: draft.amount! };
      const res = save ? await save(input) : await saveTransaction(bookId, input);
      if (!res.ok) {
        setErrors((res.fieldErrors ?? {}) as Errors);
        return setFormError(res.fieldErrors ? null : res.error);
      }
      const nameOf = (id?: string) => options.categories.find((c) => c.id === id)?.name;
      const what = [
        draft.type === "transfer" ? `${nameOf(draft.from_category_id)} → ${nameOf(draft.category_id)}` : nameOf(draft.category_id),
        formatMoney(draft.amount!, options.money),
      ]
        .filter(Boolean)
        .join(" · ");
      toast(isEdit ? `Updated ${what}` : `Added ${what}`, {
        status: dueOff ? "information" : "success",
        description:
          linked && dueOff
            ? `${linked.name} is due ${formatMoney(linked.monthly_amount, options.money)} a month; this is ${formatMoney(Math.abs(dueOff), options.money)} ${dueOff > 0 ? "more" : "less"}.`
            : linked
              ? `Payment for ${linked.name}`
              : undefined,
      });
      if (another) {
        // Same type, date and member; a clean amount and category for the next one.
        setDraft((d) => ({ ...blank(d.date, d.member ?? ""), type: d.type }));
        setLinkTouched(false);
        setErrors({});
        setEntry((n) => n + 1);
        return;
      }
      onDone();
    });
  }

  function destroy() {
    if (!draft.id) return;
    startTransition(async () => {
      const res = await deleteTransactions(bookId, { ids: [draft.id!] });
      if (!res.ok) return setFormError(res.error);
      const rows = res.data ?? [];
      const name = options.categories.find((c) => c.id === draft.category_id)?.name ?? "transaction";
      undoToast(`Deleted ${name} · ${formatMoney(draft.amount ?? 0, options.money)}`, () => restoreTransactions(bookId, { rows }));
      onDone();
    });
  }

  return (
    <DrawerForm
      title={title ?? (isEdit ? "Edit transaction" : "New transaction")}
      description={description}
      onSubmit={() => submit()}
      error={summarizeErrors(errors) ?? formError}
      destructive={
        isEdit ? (
          <Button type="button" variant="ghost" leadingIcon={RiDeleteBinLine} onClick={destroy} disabled={pending} className="bg-transparent text-text-error-primary hover:bg-background-tertiary-error active:bg-background-tertiary-error">
            Delete
          </Button>
        ) : null
      }
      footer={
        <>
          {isEdit || save ? null : (
            <Button type="button" variant="secondary" onClick={() => submit(true)} disabled={pending}>
              Save &amp; add another
            </Button>
          )}
          <Button type="submit" variant="primary" disabled={pending}>
            {pending ? "Saving…" : isEdit ? "Save changes" : "Add transaction"}
          </Button>
        </>
      }
    >
      <SegmentedControl
        aria-label="Type"
        className="w-full [&>*]:flex-1"
        selectedKeys={[draft.type]}
        onSelectionChange={(keys) => {
          const type = [...keys][0] as Draft["type"] | undefined;
          if (type && type !== draft.type) {
            setErrors({});
            setLinkTouched(false);
            setDraft((d) => {
              const next = { ...d, type, category_id: "", from_category_id: "", installment_id: "" };
              return type === "expense" ? withInstallment(next, matchInstallment(d.description ?? "", options.installments)) : next;
            });
          }
        }}
      >
        <SegmentedControlItem id="expense">Expense</SegmentedControlItem>
        <SegmentedControlItem id="income">Income</SegmentedControlItem>
        <SegmentedControlItem id="transfer">Transfer</SegmentedControlItem>
      </SegmentedControl>

      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <MoneyField
          key={entry}
          label="Amount"
          value={draft.amount}
          onChange={(v) => set("amount", v)}
          money={options.money}
          autoFocus={!isEdit}
          isRequired
          error={errors.amount}
          fieldClassName="px-2.5 py-2"
          inputClassName="field-display text-title-1-semibold"
        />
        <TodayDateField value={draft.date} today={options.today} onChange={(v) => set("date", v)} error={errors.date} />
      </div>

      {draft.type === "transfer" ? (
        <>
          <CategoryPicker
            label="From"
            categories={movable}
            use={options.categoryUse}
            value={draft.from_category_id ?? ""}
            onChange={(v) => set("from_category_id", v)}
            error={errors.from_category_id}
          />
          <CategoryPicker
            label="To"
            // Same tiles in the same places as "From", so nothing shifts under the thumb.
            categories={movable}
            use={options.categoryUse}
            value={draft.category_id ?? ""}
            onChange={(v) => set("category_id", v)}
            error={errors.category_id}
          />
          <TransferEffect
            from={options.categories.find((c) => c.id === draft.from_category_id)}
            to={options.categories.find((c) => c.id === draft.category_id)}
            amount={draft.amount ? formatMoney(draft.amount, options.money) : "the amount"}
          />
        </>
      ) : (
        <CategoryPicker
          categories={options.categories.filter((c) => c.kind === kind)}
          use={options.categoryUse}
          value={draft.category_id ?? ""}
          onChange={(v) => set("category_id", v)}
          error={errors.category_id}
        />
      )}

      <DescriptionField
        key={`description-${entry}`}
        value={draft.description ?? ""}
        onChange={onDescription}
        onPick={onPick}
        options={options}
        type={draft.type}
        placeholder={draft.type === "transfer" ? "e.g. Tabungan Travel" : "e.g. Nasi Padang"}
        error={errors.description}
      />

      {linked ? (
        <InstallmentNotice
          name={linked.name}
          // A saved payment keeps the instalment it settled; anything new settles the next open one.
          payment={(draft.id ? linked.stepOf[draft.id] : undefined) ?? linked.nextStep}
          tenor={linked.tenor_months}
          due={formatMoney(linked.monthly_amount, options.money)}
          off={dueOff ? `${formatMoney(Math.abs(dueOff), options.money)} ${dueOff > 0 ? "more" : "less"}` : ""}
          onUseDue={() => set("amount", linked.monthly_amount)}
          onUnlink={() => {
            setLinkTouched(true);
            set("installment_id", "");
          }}
        />
      ) : null}

      <button
        type="button"
        aria-expanded={details}
        onClick={() => setDetails((d) => !d)}
        className="-mx-2 flex min-h-11 cursor-pointer items-center justify-between gap-2 rounded-xl px-2 text-body-medium text-text-secondary outline-none hover:bg-background-secondary-hover focus-visible:ring-2 focus-visible:ring-border-focus-ring sm:min-h-9"
      >
        <span>More details</span>
        <span className="flex min-w-0 items-center gap-1 text-body-2-regular">
          {!details ? <span className="truncate">{detailSummary(draft, member)}</span> : null}
          <RiArrowDownSLine className={cx("size-5 shrink-0 transition-transform duration-200", details && "rotate-180")} aria-hidden />
        </span>
      </button>

      {details ? (
        <>
          {options.members.length > 0 ? (
            <SelectField
              label="Member"
              value={draft.member ?? ""}
              onChange={(v) => set("member", v)}
              options={options.members.map((m) => ({ id: m, label: m }))}
              allowEmpty="Household"
            />
          ) : null}

          {draft.type === "expense" && options.installments.length > 0 ? (
            <SelectField
              label="Installment payment"
              value={draft.installment_id ?? ""}
              onChange={onInstallment}
              options={options.installments.map((i) => ({ id: i.id, label: i.name }))}
              allowEmpty="Not an installment"
            />
          ) : null}

          <Checkbox isSelected={draft.verified} onChange={(v) => set("verified", v)} className="min-h-11 sm:min-h-0">
            Verified against bank statement
          </Checkbox>
        </>
      ) : null}
    </DrawerForm>
  );
}

type Errors = Partial<Record<keyof Draft, string>>;

/** What "More details" holds, so a folded section still says what's in it. */
function detailSummary(d: Draft, viewer: string) {
  const parts = [d.member && d.member !== viewer ? d.member : !d.member ? "Household" : "", d.verified ? "Verified" : ""];
  return parts.filter(Boolean).join(" · ") || "Member, installment, verified";
}

/**
 * Shown while an expense is linked to an installment: which payment it is, and a
 * warning (with a one-click fix) when the amount isn't the monthly due.
 */
function InstallmentNotice({
  name,
  payment,
  tenor,
  due,
  off,
  onUseDue,
  onUnlink,
}: {
  name: string;
  /** 1-based number of this payment. */
  payment: number;
  tenor: number;
  due: string;
  /** "Rp 50.000 more" when the amount differs from the due; "" when it matches. */
  off: string;
  onUseDue: () => void;
  onUnlink: () => void;
}) {
  const action =
    "cursor-pointer rounded-md text-body-2-medium outline-none hover:underline focus-visible:ring-2 focus-visible:ring-border-focus-ring";
  return (
    <div
      aria-live="polite"
      className="flex flex-col gap-1.5 rounded-xl bg-background-secondary-default px-3 py-2.5"
    >
      <div className="flex items-start gap-2">
        <RiCalendarScheduleLine className="mt-0.5 size-4 shrink-0 text-foreground-icon-secondary" aria-hidden />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-body-2-medium text-text-primary">
            Installment payment · {name}
          </span>
          <span className="text-caption-1-regular text-text-secondary tabular-nums">
            Payment {Math.min(Math.max(payment, 1), tenor)} of {tenor} · due {due} a month
          </span>
        </div>
        <button type="button" onClick={onUnlink} className={cx(action, "shrink-0 text-text-secondary")}>
          Not an installment
        </button>
      </div>
      {off ? (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 ps-6 text-text-negative">
          <RiAlertLine className="size-4 shrink-0" aria-hidden />
          <span className="text-body-2-regular">
            {off} than the {due} due.
          </span>
          <button type="button" onClick={onUseDue} className={cx(action, "text-button-ghost-foreground underline")}>
            Use {due}
          </button>
        </div>
      ) : null}
    </div>
  );
}

/** The date as a compact "Today" / "Yesterday" / "3 Nov" chip beside the amount. */
function TodayDateField({ value, today, onChange, error }: { value: string; today: string; onChange: (v: string) => void; error?: string }) {
  const labelId = useId();
  let parsed: CalendarDate | null = null;
  try {
    parsed = value ? parseDate(value) : null;
  } catch {
    parsed = null;
  }
  const t = parseDate(today);
  const format = (d: CalendarDate) =>
    d.compare(t) === 0
      ? "Today"
      : d.compare(t.subtract({ days: 1 })) === 0
        ? "Yesterday"
        : new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", ...(d.year !== t.year ? { year: "numeric" } : {}) }).format(d.toDate("UTC"));
  return (
    <div className="flex flex-col gap-1">
      <Label id={labelId}>Date</Label>
      <DatePicker
        aria-labelledby={labelId}
        isInvalid={Boolean(error)}
        value={parsed}
        onChange={(d) => onChange(d ? d.toString() : "")}
        formatValue={format}
        className="h-[2.625rem] px-2.5"
      />
    </div>
  );
}

type FormCategory = FormOptions["categories"][number];

/** What a transfer does to each side: a budget gives up room, a savings pot fills or drains. */
function TransferEffect({ from, to, amount }: { from?: FormCategory; to?: FormCategory; amount: string }) {
  if (!from && !to) return null;
  const effect = (c: FormCategory | undefined, out: boolean) =>
    !c ? "Pick a category" : c.group === "Savings" ? `Pot ${out ? "−" : "+"}${amount}` : `Budget ${out ? "−" : "+"}${amount}`;
  const side = (c: FormCategory | undefined, out: boolean) => (
    <span className="flex min-w-0 flex-1 flex-col">
      <span className="truncate text-body-medium text-text-primary">{c?.name ?? "—"}</span>
      <span className="truncate text-caption-1-regular text-text-tertiary tabular-nums">{effect(c, out)}</span>
    </span>
  );
  return (
    <div className="flex flex-col gap-1.5 rounded-xl bg-background-secondary-default px-3 py-2.5" aria-live="polite">
      <span className="text-caption-1-medium text-text-tertiary">
        {to?.group === "Savings" && from && from.group !== "Savings"
          ? "Moves unspent budget into savings"
          : from?.group === "Savings"
            ? "Takes money out of savings"
            : "Moves budget between categories"}
      </span>
      <div className="flex items-center gap-2">
        {side(from, true)}
        <RiArrowRightLine className="size-4 shrink-0 text-foreground-icon-tertiary rtl:rotate-180" aria-label="to" />
        {side(to, false)}
      </div>
    </div>
  );
}
