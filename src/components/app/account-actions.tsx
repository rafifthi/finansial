"use client";

import { useState } from "react";
import { deleteAccount } from "@/actions/entities";
import { AlertDialog } from "@/components/base/modal/modal";
import { toast } from "@/components/base/toast/toast";
import type { AccountUsage } from "@/lib/finance/accounts";
import { formatMoney, type MoneyFormat } from "@/lib/finance/money";
import type { Account } from "@/lib/sheets/schema";
import { EntityFormButton, type FieldSpec } from "./entity-form";
import { SelectField } from "./fields";
import { useBookId } from "./permissions";

export interface DeletableAccount {
  account: Account;
  usage: AccountUsage;
  /** Transfers between this account and each other account; they'd become self-transfers on a merge. */
  transfersWith: Record<string, number>;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function usageSummary(u: AccountUsage) {
  return [
    u.transactions && plural(u.transactions, "transaction"),
    u.recurring && plural(u.recurring, "recurring item"),
    u.installments && plural(u.installments, "installment"),
    u.categories && plural(u.categories, "category", "categories"),
    u.pockets && plural(u.pockets, "budget pocket"),
  ].filter(Boolean);
}

/** Edit button for an account card; its Delete opens a dialog that moves the account's rows elsewhere first. */
export function AccountActions({
  item,
  accounts,
  fields,
  money,
}: {
  item: DeletableAccount;
  /** Every account in the book, to pick the one to move to. */
  accounts: Account[];
  fields: FieldSpec[];
  money: MoneyFormat;
}) {
  const bookId = useBookId();
  const [confirming, setConfirming] = useState(false);
  const [target, setTarget] = useState("");
  const { account, usage, transfersWith } = item;
  const used = usageSummary(usage);
  const to = accounts.find((a) => a.id === target);
  const options = accounts.filter((a) => a.id !== account.id && !a.archived).map((a) => ({ id: a.id, label: a.name }));
  const dropped = target ? (transfersWith[target] ?? 0) : 0;

  const confirm = async () => {
    const res = await deleteAccount(bookId, { id: account.id, move_to: used.length ? target : "" });
    if (!res.ok) {
      toast("Couldn't delete account", { status: "error", description: res.error });
      throw new Error(res.error);
    }
    toast(to ? `${account.name} deleted, moved to ${to.name}` : `${account.name} deleted`, { status: "success" });
  };

  return (
    <>
      <EntityFormButton
        table="accounts"
        title="Account"
        trigger="icon"
        fields={fields}
        money={money}
        initial={account}
        onDelete={() => {
          setTarget("");
          setConfirming(true);
        }}
      />
      <AlertDialog
        isOpen={confirming}
        onOpenChange={setConfirming}
        title={`Delete ${account.name}?`}
        description={
          used.length
            ? `It's still used by ${used.join(", ")}. Move all of it to another account, then ${account.name} is removed.`
            : `It isn't used anywhere. This can't be undone.`
        }
        confirmLabel={used.length ? "Move and delete" : "Delete"}
        pendingLabel="Deleting…"
        isConfirmDisabled={used.length > 0 && !target}
        onConfirm={confirm}
      >
        {used.length ? (
          <div className="flex flex-col gap-3">
            {options.length ? (
              <SelectField label="Move everything to" value={target} onChange={setTarget} options={options} placeholder="Choose an account" />
            ) : (
              <p className="text-body-regular text-text-error-primary">Add another account first so there&apos;s somewhere to move to.</p>
            )}
            {to ? (
              <ul className="flex list-disc flex-col gap-1 ps-5 text-body-2-regular text-text-secondary">
                {account.opening_balance ? (
                  <li>
                    {to.name}&apos;s opening balance grows by {formatMoney(account.opening_balance, money)}, so your totals stay the same.
                  </li>
                ) : null}
                {dropped ? (
                  <li>
                    {plural(dropped, "transfer")} between {account.name} and {to.name} will be removed, since they&apos;d become a transfer to itself.
                  </li>
                ) : null}
                <li>This can&apos;t be undone. To keep history under its own name, archive the account instead.</li>
              </ul>
            ) : null}
          </div>
        ) : null}
      </AlertDialog>
    </>
  );
}
