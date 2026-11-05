import { CardSkeleton, ChartSkeleton, HeaderSkeleton, MetersSkeleton, PageSkeleton, RowsSkeleton, StatsSkeleton } from "@/components/app/skeletons";

export default function DashboardLoading() {
  return (
    <PageSkeleton label="dashboard">
      <HeaderSkeleton actions={2} />
      <CardSkeleton title={false}>
        <StatsSkeleton count={4} />
      </CardSkeleton>
      <div className="grid gap-4 xl:grid-cols-3">
        <CardSkeleton className="xl:col-span-2">
          <ChartSkeleton />
        </CardSkeleton>
        <CardSkeleton>
          <ChartSkeleton />
        </CardSkeleton>
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <CardSkeleton className="xl:col-span-2">
          <MetersSkeleton count={6} />
        </CardSkeleton>
        <CardSkeleton>
          <RowsSkeleton rows={4} tile="rect" />
        </CardSkeleton>
      </div>
    </PageSkeleton>
  );
}
