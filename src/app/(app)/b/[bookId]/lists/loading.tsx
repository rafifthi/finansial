import { CardSkeleton, HeaderSkeleton, PageSkeleton, RowsSkeleton } from "@/components/app/skeletons";

export default function ListsLoading() {
  return (
    <PageSkeleton label="lists">
      <HeaderSkeleton actions={1} />
      <div className="grid items-start gap-4 sm:grid-cols-[14rem_minmax(0,1fr)] lg:grid-cols-[16rem_minmax(0,1fr)]">
        <CardSkeleton title={false} className="max-sm:hidden">
          <RowsSkeleton rows={5} tile="rect" />
        </CardSkeleton>
        <CardSkeleton>
          <RowsSkeleton rows={6} tile="none" />
        </CardSkeleton>
      </div>
    </PageSkeleton>
  );
}
