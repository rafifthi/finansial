import { Skeleton } from "@/components/base/skeleton/skeleton";
import { HeaderSkeleton, PageSkeleton } from "@/components/app/skeletons";

export default function CatatLoading() {
  return (
    <PageSkeleton label="Catat">
      <HeaderSkeleton actions={0} />
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-end gap-3">
        <Skeleton shape="text" className="h-4 w-56 self-center" />
        <Skeleton className="h-28 w-full rounded-3xl" />
      </div>
    </PageSkeleton>
  );
}
