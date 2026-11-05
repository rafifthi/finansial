import { CardSkeleton, HeaderSkeleton, PageSkeleton, RowsSkeleton } from "@/components/app/skeletons";

export default function ReconcileLoading() {
  return (
    <PageSkeleton label="reconcile">
      <HeaderSkeleton actions={0} />
      <CardSkeleton title={false}>
        <RowsSkeleton rows={8} />
      </CardSkeleton>
    </PageSkeleton>
  );
}
