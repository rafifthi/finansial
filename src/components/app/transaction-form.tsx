"use client";

import { useState, useTransition } from "react";
import { RiBankLine, RiDeleteBinLine } from "@remixicon/react";
import { deleteTransactions, saveTransaction, type TxnInput } from "@/actions/transactions";
import { Button } from "@/components/base/buttons/button";
import { Checkbox } from "@/components/base/checkbox/checkbox";
import { Input } from "@/components/base/input/input";
import { SegmentedControl, SegmentedControlItem } from "@/components/base/segmented-control/segmented-control";
import { toast } from "@/components/base/toast/toast";
import type { FormOptions } from "@/lib/data/app-data";
import type { Transaction } from "@/lib/sheets/schema";
import { AccountLogo } from "./account-logo";
import { DateField, MoneyField, SelectField } from "./fields";
import { DrawerForm, FormDrawer, FormError } from "./form-drawer";
import { useBookId, useViewerMember } from "./permissions";

type Draft = Omit<TxnInput, "amount"> & { amount: number | null };

const blank = (today: string, member: string): Draft => ({
  date: today,
  type: "expense",
  amount: null,
  category_id: "",
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
  const [draft, setDraft] = useState<Draft>(initial ?? blank(options.today, options.members.includes(member) ? member : ""));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const isEdit = Boolean(draft.id);
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  const kind = draft.type === "income" ? "income" : "expense";
  const label = (c: FormOptions["categories"][number]) => [c.emoji, c.name].filter(Boolean).join(" ");
  const categoryOptions = options.categories
    .filter((c) => c.kind === kind)
    .map((c) => ({ id: c.id, label: `${label(c)} · ${c.group}` }));
  const accountOptions = options.accounts.map((a) => ({ id: a.id, label: a.name }));
  const accountName = (id: string) => options.accounts.find((a) => a.id === id)?.name;
  const categoryAccount = options.categories.find((c) => c.id === draft.category_id)?.default_account_id ?? "";

  function onCategory(id: string) {
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

  function submit() {
    setError(null);
    if (draft.amount === null) return setError("Enter an amount");
    startTransition(async () => {
      const res = await saveTransaction(bookId, { ...draft, amount: draft.amount! });
      if (!res.ok) return setError(res.error);
      toast(isEdit ? "Transaction updated" : "Transaction added", { status: "success" });
      onDone();
    });
  }

  function destroy() {
    if (!draft.id) return;
    startTransition(async () => {
      const res = await deleteTransactions(bookId, { ids: [draft.id!] });
      if (!res.ok) return setError(res.error);
      toast("Transaction deleted", { status: "success" });
      onDone();
    });
  }

  return (
    <DrawerForm
      title={isEdit ? "Edit transaction" : "New transaction"}
      onSubmit={submit}
      footer={
        <>
          {isEdit ? (
            <Button type="button" variant="danger" leadingIcon={RiDeleteBinLine} onClick={destroy} disabled={pending}>
              Delete
            </Button>
          ) : (
            <span className="hidden sm:block" />
          )}
          <Button type="submit" variant="primary" disabled={pending}>
            {pending ? "Saving…" : isEdit ? "Save changes" : "Add transaction"}
          </Button>
        </>
      }
    >
        <SegmentedControl
          aria-label="Type"
          selectedKeys={[draft.type]}
          onSelectionChange={(keys) => {
            const type = [...keys][0] as Draft["type"] | undefined;
            if (type && type !== draft.type)
              setDraft((d) => ({ ...d, type, category_id: "", installment_id: "", account_id: options.accountOverride ? d.account_id : "" }));
          }}
        >
          <SegmentedControlItem id="expense">Expense</SegmentedControlItem>
          <SegmentedControlItem id="income">Income</SegmentedControlItem>
          <SegmentedControlItem id="transfer">Transfer</SegmentedControlItem>
        </SegmentedControl>

        <MoneyField label="Amount" value={draft.amount} onChange={(v) => set("amount", v)} money={options.money} autoFocus={!isEdit} />
        <DateField label="Date" value={draft.date} onChange={(v) => set("date", v)} />

        {draft.type === "transfer" ? (
          <>
            <SelectField label="From account" value={draft.account_id ?? ""} onChange={(v) => set("account_id", v)} options={accountOptions} />
            <SelectField label="To account" value={draft.to_account_id ?? ""} onChange={(v) => set("to_account_id", v)} options={accountOptions} />
            <SelectField
              label="Savings category"
              value={draft.category_id ?? ""}
              onChange={(v) => set("category_id", v)}
              options={options.categories.filter((c) => c.group === "Savings").map((c) => ({ id: c.id, label: label(c) }))}
              allowEmpty="None (plain transfer)"
            />
          </>
        ) : (
          <>
            <SelectField label="Category" value={draft.category_id ?? ""} onChange={onCategory} options={categoryOptions} />
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

        <Input label="Description" value={draft.description ?? ""} onChange={(v) => set("description", v)} placeholder="e.g. Nasi Padang" />

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

        <Checkbox isSelected={draft.verified} onChange={(v) => set("verified", v)}>
          Verified against bank statement
        </Checkbox>

        <FormError>{error}</FormError>
    </DrawerForm>
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
