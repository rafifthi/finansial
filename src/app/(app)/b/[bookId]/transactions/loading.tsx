import { Skeleton } from "@/components/base/skeleton/skeleton";
import { CardSkeleton, HeaderSkeleton, PageSkeleton, RowsSkeleton } from "@/components/app/skeletons";

export default function TransactionsLoading() {
  return (
    <PageSkeleton label="transactions">
      <HeaderSkeleton actions={2} />
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-9 w-full sm:w-64" />
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-9 w-32" />
      </div>
      <CardSkeleton title={false}>
        <RowsSkeleton rows={10} />
      </CardSkeleton>
    </PageSkeleton>
  );
}
