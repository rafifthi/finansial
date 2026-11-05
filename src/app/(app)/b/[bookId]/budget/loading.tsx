import { CardSkeleton, HeaderSkeleton, PageSkeleton, RowsSkeleton, StatsSkeleton } from "@/components/app/skeletons";

export default function BudgetLoading() {
  return (
    <PageSkeleton label="budget">
      <HeaderSkeleton actions={1} wide />
      <CardSkeleton title={false}>
        <StatsSkeleton count={3} />
      </CardSkeleton>
      <div className="grid gap-4 xl:grid-cols-2">
        {["Income", "Savings", "Needs", "Wants"].map((g) => (
          <CardSkeleton key={g}>
            <RowsSkeleton rows={4} tile="rect" />
          </CardSkeleton>
        ))}
      </div>
    </PageSkeleton>
  );
}
