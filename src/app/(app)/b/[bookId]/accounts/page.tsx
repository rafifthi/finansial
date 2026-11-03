import type { Metadata } from "next";
import { requireBookPage } from "@/auth";
import Link from "next/link";
import { AccountActions } from "@/components/app/account-actions";
import { Card, EmptyState } from "@/components/app/card";
import { EntityFormButton } from "@/components/app/entity-form";
import { PageHeader } from "@/components/app/page-header";
import { Chip } from "@/components/base/badges/chip";
import { loadAppData } from "@/lib/data/app-data";
import { fieldSpecs } from "@/lib/data/field-specs";
import { accountUsage } from "@/lib/finance/accounts";
import { accountBalances } from "@/lib/finance/ledger";
import { formatMoney } from "@/lib/finance/money";

export const metadata: Metadata = { title: "Accounts" };

const TYPE_LABEL: Record<string, string> = {
  bank: "Bank",
  ewallet: "E-wallet",
  cash: "Cash",
  credit_card: "Credit card",
  investment: "Investment",
};

export default async function AccountsPage({ params }: PageProps<"/b/[bookId]/accounts">) {
  const data = await loadAppData(await requireBookPage((await params).bookId));
  const specs = fieldSpecs(data);
  const balances = accountBalances(data.accounts, data.transactions);
  const verified = accountBalances(data.accounts, data.transactions.filter((t) => t.verified));
  const fmt = (n: number) => formatMoney(n, data.money);
  /** Transfers (and recurring transfers) between `id` and each other account. */
  const transfersWith = (id: string) => {
    const out: Record<string, number> = {};
    for (const t of [...data.transactions, ...data.recurring]) {
      if (t.type !== "transfer") continue;
      const other = t.account_id === id ? t.to_account_id : t.to_account_id === id ? t.account_id : "";
      if (other) out[other] = (out[other] ?? 0) + 1;
    }
    return out;
  };
  const total = data.accounts.filter((a) => !a.archived).reduce((s, a) => s + (balances.get(a.id) ?? 0), 0);

  return (
    <>
      <PageHeader
        title="Accounts"
        description={`Balances are derived from opening balance + every transaction. Net: ${fmt(total)}`}
        actions={
          <EntityFormButton table="accounts" title="Account" fields={specs.accounts} money={data.money} initial={{ type: "bank", opening_balance: 0 }} />
        }
      />
      {data.accounts.length === 0 ? (
        <Card>
          <EmptyState>No accounts yet. Add Jenius, Jago, cash… whatever you pay from.</EmptyState>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.accounts.map((a) => {
            const bal = balances.get(a.id) ?? 0;
            const diff = bal - (verified.get(a.id) ?? 0);
            return (
              <Card
                key={a.id}
                title={a.name}
                className={a.archived ? "opacity-60" : undefined}
                action={
                  <AccountActions
                    item={{ account: a, usage: accountUsage(a.id, data), transfersWith: transfersWith(a.id) }}
                    accounts={data.accounts}
                    fields={specs.accounts}
                    money={data.money}
                  />
                }
              >
                <div className="flex flex-col gap-1">
                  <span className="text-display-4-medium text-text-primary tabular-nums">{fmt(bal)}</span>
                  <div className="flex flex-wrap items-center gap-2">
                    <Chip color="neutral">{TYPE_LABEL[a.type]}</Chip>
                    {a.archived ? <Chip color="soft">Archived</Chip> : null}
                    {diff !== 0 ? (
                      <Link href={data.href(`/reconcile?account=${a.id}`)}>
                        <Chip color="yellow">{fmt(diff)} unverified</Chip>
                      </Link>
                    ) : null}
                  </div>
                </div>
                <Link href={data.href(`/transactions?account=${a.id}`)} className="text-body-2-medium text-accent-600 hover:underline dark:text-accent-400">
                  View transactions
                </Link>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
