"use client";

import { useState, useTransition } from "react";
import { RiBankLine } from "@remixicon/react";
import { setAccountOverride, setGroupPocket } from "@/actions/entities";
import { Button } from "@/components/base/buttons/button";
import { Switch } from "@/components/base/switch/switch";
import { toast } from "@/components/base/toast/toast";
import type { CategoryGroup } from "@/lib/finance/accounts";
import { SelectField, type Option } from "./fields";
import { DrawerForm, FormDrawer } from "./form-drawer";
import { useBookId, useCan } from "./permissions";

/**
 * Book switch: off (default), a transaction's account always comes from its
 * category and the form only shows it; on, the form adds a picker to override it.
 */
export function AccountOverrideSetting({ enabled }: { enabled: boolean }) {
  const bookId = useBookId();
  const canEdit = useCan("setup:write");
  const [value, setValue] = useState(enabled);
  const [pending, startTransition] = useTransition();

  const change = (next: boolean) => {
    setValue(next);
    startTransition(async () => {
      const res = await setAccountOverride(bookId, { enabled: next });
      if (res.ok) {
        toast(next ? "Transactions can pick their account" : "Transactions use their category's account", { status: "success" });
      } else {
        setValue(!next);
        toast("Couldn't save", { status: "error", description: res.error });
      }
    });
  };

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-body-medium text-text-primary">Let transactions override the account</span>
        <span className="text-body-2-regular text-text-tertiary">
          {value
            ? "The transaction form has an account picker. Left alone, it uses the category's account."
            : "Every expense and income goes to its category's account. The form shows it but can't change it."}
        </span>
      </div>
      <Switch aria-label="Let transactions override the account" isSelected={value} onChange={change} isDisabled={!canEdit || pending} />
    </div>
  );
}

/**
 * Shortcut over a group: a drawer that moves every category in it to one
 * account (new ones in the group start there too). Single categories are
 * changed in their own edit drawer.
 */
export function GroupAccountButton({
  group,
  categories,
  accounts,
}: {
  group: CategoryGroup;
  categories: { name: string; account: string }[];
  accounts: Option[];
}) {
  const [open, setOpen] = useState(false);
  if (!useCan("setup:write") || categories.length === 0) return null;
  return (
    <>
      <Button variant="ghost" size="small" leadingIcon={RiBankLine} onClick={() => setOpen(true)} className="self-start">
        Set account for all
      </Button>
      <FormDrawer isOpen={open} onOpenChange={setOpen} aria-label={`Account for all ${group}`}>
        <GroupAccountForm group={group} categories={categories} accounts={accounts} onDone={() => setOpen(false)} />
      </FormDrawer>
    </>
  );
}

function GroupAccountForm({
  group,
  categories,
  accounts,
  onDone,
}: {
  group: CategoryGroup;
  categories: { name: string; account: string }[];
  accounts: Option[];
  onDone: () => void;
}) {
  const bookId = useBookId();
  const uniform = categories.every((c) => c.account === categories[0].account) ? categories[0].account : "";
  const [target, setTarget] = useState(uniform);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const nameOf = (id: string) => accounts.find((a) => a.id === id)?.label;
  const moving = target ? categories.filter((c) => c.account !== target) : [];

  const submit = () =>
    startTransition(async () => {
      setError(null);
      const res = await setGroupPocket(bookId, { group, account_id: target });
      if (!res.ok) return setError(res.error);
      toast(`All ${group} categories now use ${nameOf(target)}`, { status: "success" });
      onDone();
    });

  return (
    <DrawerForm
      error={error}
      title={`Account for all ${group}`}
      description="Only new transactions use it. Past transactions keep their account, so balances don't change."
      onSubmit={submit}
      footer={
        <>
          <Button type="submit" variant="primary" disabled={pending || moving.length === 0}>
            {pending ? "Saving…" : moving.length ? `Move ${moving.length} ${moving.length === 1 ? "category" : "categories"}` : "Nothing to change"}
          </Button>
        </>
      }
    >
      <SelectField label="Account" value={target} onChange={setTarget} options={accounts} placeholder="Choose account" />
      {moving.length ? (
        <div className="flex flex-col gap-1">
          <span className="text-body-2-medium text-text-secondary">Will change</span>
          <ul className="flex flex-col divide-y divide-separator-border">
            {moving.map((c) => (
              <li key={c.name} className="flex items-center justify-between gap-3 py-2 text-body-2-regular">
                <span className="truncate text-text-primary">{c.name}</span>
                <span className="shrink-0 text-text-tertiary">
                  {nameOf(c.account) ?? "No account"} → {nameOf(target)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : target ? (
        <p className="text-body-2-regular text-text-tertiary">Every {group} category already uses {nameOf(target)}.</p>
      ) : null}
    </DrawerForm>
  );
}
