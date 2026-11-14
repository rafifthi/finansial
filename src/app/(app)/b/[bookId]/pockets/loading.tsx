import { Skeleton } from "@/components/base/skeleton/skeleton";
import { CardSkeleton, HeaderSkeleton, PageSkeleton, StatsSkeleton } from "@/components/app/skeletons";

export default function SavingsLoading() {
  return (
    <PageSkeleton label="pockets">
      <HeaderSkeleton actions={0} wide />
      <CardSkeleton title={false}>
        <StatsSkeleton count={3} />
      </CardSkeleton>
      <div className="grid gap-4 md:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <CardSkeleton key={i} title={false}>
            <div className="flex items-center gap-3">
              <Skeleton className="size-7 rounded-lg" />
              <Skeleton shape="text" className="h-4.5 w-28" />
            </div>
            <div className="flex items-end justify-between gap-3">
              <div className="flex flex-col gap-2">
                <Skeleton shape="text" className="h-6 w-40" />
                <Skeleton shape="text" className="h-3.5 w-32" />
              </div>
              <Skeleton className="h-10 w-28" />
            </div>
            <Skeleton shape="text" className="h-1.5 w-full rounded-full" />
          </CardSkeleton>
        ))}
      </div>
    </PageSkeleton>
  );
}
