"use client";

import { useId, useState, useTransition } from "react";
import { parseDate, type CalendarDate } from "@internationalized/date";
import { RiArrowDownSLine, RiArrowRightLine, RiBankLine, RiDeleteBinLine } from "@remixicon/react";
import { deleteTransactions, restoreTransactions, saveTransaction, type TxnInput } from "@/actions/transactions";
import { Button } from "@/components/base/buttons/button";
import { Checkbox } from "@/components/base/checkbox/checkbox";
import { DatePicker } from "@/components/base/date-picker/date-picker";
import { Input } from "@/components/base/input/input";
import { Label } from "@/components/base/input/label";
import { SegmentedControl, SegmentedControlItem } from "@/components/base/segmented-control/segmented-control";
import { toast } from "@/components/base/toast/toast";
import type { FormOptions } from "@/lib/data/app-data";
import { formatMoney } from "@/lib/finance/money";
import { cx } from "@/utils/cx";
import type { Transaction } from "@/lib/sheets/schema";
import { AccountLogo } from "./account-logo";
import { CategoryPicker } from "./category-picker";
import { MoneyField, SelectField } from "./fields";
import { DrawerForm, FormDrawer, summarizeErrors } from "./form-drawer";
import { undoToast } from "./undo";
import { useBookId, useViewerMember } from "./permissions";

type Draft = Omit<TxnInput, "amount"> & { amount: number | null };

const blank = (today: string, member: string): Draft => ({
  date: today,
  type: "expense",
  amount: null,
  category_id: "",
  from_category_id: "",
  account_id: "",
  to_account_id: "",
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
    account_id: t.account_id,
    to_account_id: t.to_account_id,
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

function TransactionFormBody({
  options,
  initial,
  onDone,
}: {
  options: FormOptions;
  initial?: Draft;
  onDone: () => void;
}) {
  const member = useViewerMember();
  const bookId = useBookId();
  const fresh = () => blank(options.today, options.members.includes(member) ? member : "");
  const [draft, setDraft] = useState<Draft>(() => {
    const d = initial ?? fresh();
    // Transfers saved before they had a source category: start from the category whose account it left.
    if (d.type === "transfer" && !d.from_category_id && d.account_id) {
      return { ...d, from_category_id: options.categories.find((c) => c.default_account_id === d.account_id)?.id ?? "" };
    }
    return d;
  });
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const isEdit = Boolean(draft.id);
  // Extra fields start folded on a new entry; an edit opens them when one of them is in use.
  const [details, setDetails] = useState(
    Boolean(initial && (initial.installment_id || initial.verified || (initial.member && initial.member !== member))),
  );
  const [entry, setEntry] = useState(0);
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));
  };

  const kind = draft.type === "income" ? "income" : "expense";
  const accountOptions = options.accounts.map((a) => ({ id: a.id, label: a.name }));
  const accountName = (id: string) => options.accounts.find((a) => a.id === id)?.name;
  const categoryAccountOf = (id?: string) => options.categories.find((c) => c.id === id)?.default_account_id ?? "";
  const categoryAccount = categoryAccountOf(draft.category_id);

  function onCategory(id: string) {
    setErrors((e) => ({ ...e, category_id: undefined }));
    setDraft((d) => ({
      ...d,
      category_id: id,
      // An explicit pick (when overrides are on) sticks; otherwise the account follows the
      // category, except that an edit back to its original category keeps its original account.
      account_id: options.accountOverride ? d.account_id : initial && id === initial.category_id ? initial.account_id : "",
    }));
  }

  function onInstallment(id: string) {
    const inst = options.installments.find((i) => i.id === id);
    setDraft((d) => ({ ...d, installment_id: id, amount: d.amount ?? inst?.monthly_amount ?? null }));
  }

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
      const res = await saveTransaction(bookId, { ...draft, amount: draft.amount! });
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
      toast(isEdit ? `Updated ${what}` : `Added ${what}`, { status: "success" });
      if (another) {
        // Same type, date and member; a clean amount and category for the next one.
        setDraft((d) => ({ ...blank(d.date, d.member ?? ""), type: d.type }));
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
      title={isEdit ? "Edit transaction" : "New transaction"}
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
          {isEdit ? null : (
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
            setDraft((d) => ({ ...d, type, category_id: "", from_category_id: "", installment_id: "", account_id: options.accountOverride ? d.account_id : "" }));
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
            categories={options.categories}
            use={options.categoryUse}
            value={draft.from_category_id ?? ""}
            onChange={(v) => set("from_category_id", v)}
            error={errors.from_category_id}
          />
          <CategoryPicker
            label="To"
            // Same tiles in the same places as "From", so nothing shifts under the thumb.
            categories={options.categories}
            use={options.categoryUse}
            value={draft.category_id ?? ""}
            onChange={(v) => set("category_id", v)}
            error={errors.category_id}
          />
          <TransferAccounts
            from={options.accounts.find((a) => a.id === categoryAccountOf(draft.from_category_id))}
            to={options.accounts.find((a) => a.id === categoryAccountOf(draft.category_id))}
          />
        </>
      ) : (
        <>
          <CategoryPicker
            categories={options.categories.filter((c) => c.kind === kind)}
            use={options.categoryUse}
            value={draft.category_id ?? ""}
            onChange={onCategory}
            error={errors.category_id}
          />
          {options.accountOverride ? (
            <SelectField
              label={draft.type === "income" ? "Received into" : "Paid from"}
              value={draft.account_id ?? ""}
              onChange={(v) => set("account_id", v)}
              options={accountOptions}
              allowEmpty={categoryAccount && accountName(categoryAccount) ? `Category account (${accountName(categoryAccount)})` : "Category account"}
            />
          ) : (
            <CategoryAccount
              type={draft.type}
              account={draft.category_id ? (options.accounts.find((a) => a.id === (draft.account_id || categoryAccount)) ?? "none") : null}
            />
          )}
        </>
      )}

      <Input
        label="Description"
        isRequired
        value={draft.description ?? ""}
        onChange={(v) => set("description", v)}
        placeholder={draft.type === "transfer" ? "e.g. Tabungan Travel" : "e.g. Nasi Padang"}
        isInvalid={Boolean(errors.description)}
        errorMessage={errors.description}
        maxLength={200}
      />

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

/** Where a transfer physically moves money: the two categories' accounts. */
function TransferAccounts({ from, to }: { from?: FormOptions["accounts"][number]; to?: FormOptions["accounts"][number] }) {
  if (!from && !to) return null;
  const side = (a?: FormOptions["accounts"][number]) => (
    <span className="flex min-w-0 flex-1 items-center gap-1.5 text-body-medium text-text-primary">
      {a ? <AccountLogo account={a} size="sm" /> : null}
      <span className="truncate">{a?.name ?? "Pick a category"}</span>
    </span>
  );
  return (
    <div className="flex flex-col gap-1 rounded-xl bg-background-secondary-default px-3 py-2.5">
      <span className="text-caption-1-medium text-text-tertiary">
        {from && to && from.id === to.id ? "Both use the same account, so only the budget moves" : "Money moves between accounts"}
      </span>
      <div className="flex items-center gap-2">
        {side(from)}
        <RiArrowRightLine className="size-4 shrink-0 text-foreground-icon-tertiary" aria-label="to" />
        {side(to)}
      </div>
    </div>
  );
}

/**
 * Read-only account line: with overrides off, the category decides where the
 * money comes from (Settings → Categories), so the form only shows it.
 */
function CategoryAccount({
  type,
  account,
}: {
  type: Draft["type"];
  /** null: no category yet; "none": the category has no account. */
  account: FormOptions["accounts"][number] | "none" | null;
}) {
  const found = account && account !== "none" ? account : null;
  return (
    <div className="flex items-center gap-3 rounded-xl bg-background-secondary-default px-3 py-2.5">
      {found ? (
        <AccountLogo account={found} size="sm" />
      ) : (
        <RiBankLine className="size-4 shrink-0 text-foreground-icon-tertiary" aria-hidden />
      )}
      <div className="flex min-w-0 flex-col">
        <span className="text-caption-1-medium text-text-tertiary">{type === "income" ? "Received into" : "Paid from"}</span>
        <span className={found ? "truncate text-body-medium text-text-primary" : "text-body-regular text-text-tertiary"}>
          {account === null ? "Follows the category" : found ? found.name : "No account set for this category"}
        </span>
      </div>
      {found ? <span className="ms-auto shrink-0 text-caption-1-regular text-text-tertiary">Category&apos;s account</span> : null}
    </div>
  );
}
