import { Skeleton } from "@/components/base/skeleton/skeleton";
import { CardSkeleton, PageSkeleton, RowsSkeleton, StatsSkeleton } from "@/components/app/skeletons";

export default function InstallmentLoading() {
  return (
    <PageSkeleton label="installment">
      <Skeleton shape="text" className="h-4 w-16" />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-2">
          <Skeleton shape="text" className="h-7 w-32" />
          <Skeleton shape="text" className="h-6 w-44" />
        </div>
        <Skeleton className="h-9 w-36" />
      </div>
      <CardSkeleton title={false}>
        <StatsSkeleton count={4} />
      </CardSkeleton>
      <CardSkeleton>
        <RowsSkeleton rows={8} tile="none" />
      </CardSkeleton>
    </PageSkeleton>
  );
}
