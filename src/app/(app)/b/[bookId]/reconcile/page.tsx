import type { Metadata } from "next";
import { requireBookPage } from "@/auth";
import { PageHeader } from "@/components/app/page-header";
import { TransactionsView, type TxnRow } from "@/components/app/transactions-view";
import { formOptions, loadAppData } from "@/lib/data/app-data";

export const metadata: Metadata = { title: "Reconcile" };

export default async function ReconcilePage({ params }: PageProps<"/b/[bookId]/reconcile">) {
  const data = await loadAppData(await requireBookPage((await params).bookId));
  const rows: TxnRow[] = data.transactions
    .filter((t) => !t.verified)
    .map((t) => ({
      txn: t,
      categoryName: data.categoryById.get(t.category_id)?.name ?? "",
      group: data.categoryById.get(t.category_id)?.group ?? "",
      categoryEmoji: data.categoryById.get(t.category_id)?.emoji ?? "",
      categoryColor: data.categoryById.get(t.category_id)?.color ?? "",
      fromCategoryName: data.categoryById.get(t.from_category_id)?.name ?? "",
    }));

  return (
    <>
      <PageHeader title="Reconcile" description="Tick off transactions once they match your bank statement." />
      <TransactionsView rows={rows} options={formOptions(data)} compact />
    </>
  );
}
