import { CardSkeleton, HeaderSkeleton, PageSkeleton, RowsSkeleton, StatsSkeleton } from "@/components/app/skeletons";

export default function BillLoading() {
  return (
    <PageSkeleton label="bill">
      <HeaderSkeleton actions={2} />
      <CardSkeleton title={false}>
        <StatsSkeleton count={3} />
      </CardSkeleton>
      <CardSkeleton>
        <RowsSkeleton rows={8} tile="none" />
      </CardSkeleton>
    </PageSkeleton>
  );
}
