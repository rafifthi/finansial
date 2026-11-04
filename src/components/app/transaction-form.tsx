"use client";

import { useState, useTransition } from "react";
import { RiDeleteBinLine } from "@remixicon/react";
import { deleteTransactions, saveTransaction, type TxnInput } from "@/actions/transactions";
import { Button } from "@/components/base/buttons/button";
import { Checkbox } from "@/components/base/checkbox/checkbox";
import { Input } from "@/components/base/input/input";
import { SegmentedControl, SegmentedControlItem } from "@/components/base/segmented-control/segmented-control";
import { toast } from "@/components/base/toast/toast";
import type { FormOptions } from "@/lib/data/app-data";
import type { Transaction } from "@/lib/sheets/schema";
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
  const categoryOptions = options.categories
    .filter((c) => c.kind === kind)
    .map((c) => ({ id: c.id, label: `${c.name} · ${c.group}` }));
  const accountOptions = options.accounts.map((a) => ({ id: a.id, label: a.name }));

  function onCategory(id: string) {
    const cat = options.categories.find((c) => c.id === id);
    setDraft((d) => ({
      ...d,
      category_id: id,
      // Follow the category's default account unless the user already picked one.
      account_id: d.account_id || cat?.default_account_id || "",
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
            if (type && type !== draft.type) setDraft((d) => ({ ...d, type, category_id: "", installment_id: "" }));
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
              onChange={onCategory}
              options={options.categories.filter((c) => c.group === "Savings").map((c) => ({ id: c.id, label: c.name }))}
              allowEmpty="None (plain transfer)"
              searchable
            />
          </>
        ) : (
          <>
            <SelectField label="Category" value={draft.category_id ?? ""} onChange={onCategory} options={categoryOptions} searchable />
            <SelectField label="Account" value={draft.account_id ?? ""} onChange={(v) => set("account_id", v)} options={accountOptions} allowEmpty="Category default" />
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
