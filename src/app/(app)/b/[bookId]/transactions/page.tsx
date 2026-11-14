import type { Metadata } from "next";
import { requireBookPage } from "@/auth";
import { MonthNav } from "@/components/app/month-nav";
import { PageHeader } from "@/components/app/page-header";
import { ReferenceSyncButton } from "@/components/app/reference-sync";
import { TransactionsView, type TxnRow } from "@/components/app/transactions-view";
import { formOptions, loadAppData, monthParam } from "@/lib/data/app-data";
import { usingDemoDb } from "@/lib/data/store";
import { periodOf } from "@/lib/finance/period";

export const metadata: Metadata = { title: "Transactions" };

const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");

export default async function TransactionsPage({ params: route, searchParams }: PageProps<"/b/[bookId]/transactions">) {
  const params = await searchParams;
  const data = await loadAppData(await requireBookPage((await route).bookId));
  // `?txn=<id>` (e.g. from an installment's schedule) opens that transaction in its own period.
  const focus = data.transactions.find((t) => t.id === str(params.txn));
  const month = monthParam(params.m, focus ? periodOf(focus.date, data.cutoffDay) : data.current.period);
  const filters = {
    q: str(params.q),
    type: str(params.type),
    category: str(params.category),
    member: str(params.member),
    verified: str(params.verified),
  };

  const q = filters.q.toLowerCase();
  const rows: TxnRow[] = data.transactions
    .filter((t) => periodOf(t.date, data.cutoffDay) === month)
    .filter((t) => !filters.type || t.type === filters.type)
    .filter((t) => !filters.category || t.category_id === filters.category || t.from_category_id === filters.category)
    .filter((t) => !filters.member || t.member === filters.member)
    .filter((t) => !filters.verified || String(t.verified) === filters.verified)
    .filter((t) => !q || t.description.toLowerCase().includes(q) || data.categoryById.get(t.category_id)?.name.toLowerCase().includes(q))
    .map((t) => ({
      txn: t,
      categoryName: data.categoryById.get(t.category_id)?.name ?? "",
      group: data.categoryById.get(t.category_id)?.group ?? "",
      categoryEmoji: data.categoryById.get(t.category_id)?.emoji ?? "",
      categoryColor: data.categoryById.get(t.category_id)?.color ?? "",
      fromCategoryName: data.categoryById.get(t.from_category_id)?.name ?? "",
    }));

  const options = formOptions(data);

  return (
    <>
      <PageHeader
        title="Transactions"
        description="Everything in the Transactions tab of your sheet, period by period."
        actions={
          <>
            <ReferenceSyncButton linked={Boolean(data.book.migrated_from)} suggested={suggestedReference()} options={options} />
            <MonthNav month={month} path={data.href("/transactions")} params={params} cutoff={data.cutoffDay} />
          </>
        }
      />
      <TransactionsView rows={rows} options={options} filters={filters} focus={focus?.id} />
    </>
  );
}

/** The old tracker the original book was migrated from, offered when a book has none linked yet. */
function suggestedReference() {
  if (usingDemoDb()) return "demo-old-sheet";
  const id = process.env.REFERENCE_SPREADSHEET_ID;
  return id ? `https://docs.google.com/spreadsheets/d/${id}` : "";
}
