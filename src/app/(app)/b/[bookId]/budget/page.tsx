import type { Metadata } from "next";
import { requireBookPage } from "@/auth";
import { BudgetEditor, type EditorLine } from "@/components/app/budget-editor";
import { MonthNav } from "@/components/app/month-nav";
import { PageHeader } from "@/components/app/page-header";
import { loadAppData, monthParam } from "@/lib/data/app-data";
import { budgetMonth } from "@/lib/finance/budget";

export const metadata: Metadata = { title: "Budget" };

export default async function BudgetPage({ params: route, searchParams }: PageProps<"/b/[bookId]/budget">) {
  const params = await searchParams;
  const data = await loadAppData(await requireBookPage((await route).bookId));
  const month = monthParam(params.m, data.current.period);
  const bm = budgetMonth({ month, budgets: data.budgets, categories: data.categories, txns: data.transactions, cutoff: data.cutoffDay });

  const lines: EditorLine[] = [...bm.incomeLines, ...bm.lines].map((l) => ({
    categoryId: l.category.id,
    name: l.category.name,
    group: l.category.group,
    budget: l.budget,
    actual: l.actual,
  }));
  // Re-mount the editor whenever saved figures change so it never shows stale drafts.
  const version = bm.month + lines.map((l) => l.budget).join(",");

  return (
    <>
      <PageHeader
        title="Budget"
        description="Give every rupiah a job: plan income, then allocate it to savings, needs and wants."
        actions={<MonthNav month={month} path={data.href("/budget")} cutoff={data.cutoffDay} />}
      />
      <BudgetEditor key={version} month={month} lines={lines} money={data.money} />
    </>
  );
}
