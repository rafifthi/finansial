import { Skeleton } from "@/components/base/skeleton/skeleton";
import { CardSkeleton, HeaderSkeleton, PageSkeleton, RowsSkeleton } from "@/components/app/skeletons";

export default function AccountSettingsLoading() {
  return (
    <PageSkeleton label="settings">
      <HeaderSkeleton actions={0} />
      <div className="flex gap-2">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-9 w-24 rounded-full" />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <CardSkeleton>
          <RowsSkeleton rows={3} tile="none" />
        </CardSkeleton>
        <CardSkeleton>
          <RowsSkeleton rows={3} tile="none" />
        </CardSkeleton>
      </div>
    </PageSkeleton>
  );
}
