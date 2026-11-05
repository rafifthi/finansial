import { CardSkeleton, HeaderSkeleton, PageSkeleton, RowsSkeleton } from "@/components/app/skeletons";

export default function RecurringLoading() {
  return (
    <PageSkeleton label="recurring entries">
      <HeaderSkeleton actions={2} />
      <CardSkeleton>
        <RowsSkeleton rows={5} tile="rect" />
      </CardSkeleton>
    </PageSkeleton>
  );
}
