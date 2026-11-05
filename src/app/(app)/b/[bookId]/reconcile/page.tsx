import type { Metadata } from "next";
import { requireBookPage } from "@/auth";
import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { TransactionsView, type TxnRow } from "@/components/app/transactions-view";
import { formOptions, loadAppData } from "@/lib/data/app-data";
import { accountBalances } from "@/lib/finance/ledger";
import { formatMoney } from "@/lib/finance/money";
import { cx } from "@/utils/cx";

export const metadata: Metadata = { title: "Reconcile" };

export default async function ReconcilePage({ params, searchParams }: PageProps<"/b/[bookId]/reconcile">) {
  const { account } = await searchParams;
  const data = await loadAppData(await requireBookPage((await params).bookId));
  const unverified = data.transactions.filter((t) => !t.verified);
  const counts = new Map<string, number>();
  for (const t of unverified) {
    counts.set(t.account_id, (counts.get(t.account_id) ?? 0) + 1);
    if (t.to_account_id) counts.set(t.to_account_id, (counts.get(t.to_account_id) ?? 0) + 1);
  }
  const selected = typeof account === "string" ? account : "";
  const verifiedBalances = accountBalances(
    data.accounts,
    data.transactions.filter((t) => t.verified),
  );

  const rows: TxnRow[] = unverified
    .filter((t) => !selected || t.account_id === selected || t.to_account_id === selected)
    .map((t) => ({
      txn: t,
      categoryName: data.categoryById.get(t.category_id)?.name ?? "",
      group: data.categoryById.get(t.category_id)?.group ?? "",
      categoryEmoji: data.categoryById.get(t.category_id)?.emoji ?? "",
      categoryColor: data.categoryById.get(t.category_id)?.color ?? "",
      accountName: data.accountById.get(t.account_id)?.name ?? "",
      toAccountName: data.accountById.get(t.to_account_id)?.name ?? "",
    }));

  const pill = (active: boolean) =>
    cx(
      "flex items-center gap-2 rounded-full border px-3 py-1.5 text-body-2-medium outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring",
      active
        ? "border-transparent bg-accent-600 text-white"
        : "border-border-button-default bg-background-primary-default text-text-secondary hover:bg-background-primary-hover",
    );

  return (
    <>
      <PageHeader
        title="Reconcile"
        description="Tick off transactions once they match your bank statement. The balance below counts verified rows only, so it should equal the bank's figure."
      />
      <nav aria-label="Accounts" className="flex flex-wrap gap-2">
        <Link href={data.href("/reconcile")} className={pill(!selected)}>
          All <span className="tabular-nums opacity-80">{unverified.length}</span>
        </Link>
        {data.accounts
          .filter((a) => !a.archived)
          .map((a) => (
            <Link key={a.id} href={data.href(`/reconcile?account=${a.id}`)} className={pill(selected === a.id)}>
              {a.name} <span className="tabular-nums opacity-80">{counts.get(a.id) ?? 0}</span>
            </Link>
          ))}
      </nav>
      {selected ? (
        <p className="text-body-regular text-text-secondary">
          Verified balance for {data.accountById.get(selected)?.name}:{" "}
          <span className="text-body-semibold text-text-primary tabular-nums">
            {formatMoney(verifiedBalances.get(selected) ?? 0, data.money)}
          </span>
        </p>
      ) : null}
      <TransactionsView rows={rows} options={formOptions(data)} compact />
    </>
  );
}
