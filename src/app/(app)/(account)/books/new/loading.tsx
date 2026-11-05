import { Skeleton } from "@/components/base/skeleton/skeleton";
import { CardSkeleton, HeaderSkeleton, PageSkeleton } from "@/components/app/skeletons";

export default function NewBookLoading() {
  return (
    <PageSkeleton label="new book">
      <HeaderSkeleton actions={0} />
      <CardSkeleton>
        <div className="grid gap-3 sm:grid-cols-2">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
        <Skeleton className="h-9 w-32 self-end" />
      </CardSkeleton>
    </PageSkeleton>
  );
}
