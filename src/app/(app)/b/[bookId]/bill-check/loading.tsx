import { CardSkeleton, HeaderSkeleton, PageSkeleton, RowsSkeleton } from "@/components/app/skeletons";

export default function BillCheckLoading() {
  return (
    <PageSkeleton label="bill check">
      <HeaderSkeleton actions={1} />
      <CardSkeleton>
        <RowsSkeleton rows={5} tile="rect" />
      </CardSkeleton>
    </PageSkeleton>
  );
}
