import { CardSkeleton, HeaderSkeleton, PageSkeleton, RowsSkeleton } from "@/components/app/skeletons";

export default function InstallmentsLoading() {
  return (
    <PageSkeleton label="installments">
      <HeaderSkeleton actions={1} />
      <CardSkeleton>
        <RowsSkeleton rows={4} tile="rect" />
      </CardSkeleton>
    </PageSkeleton>
  );
}
