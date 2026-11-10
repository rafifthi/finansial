import { HeaderSkeleton, PageSkeleton, RowsSkeleton } from "@/components/app/skeletons";

export default function LibraryLoading() {
  return (
    <PageSkeleton label="library">
      <HeaderSkeleton actions={1} />
      <RowsSkeleton rows={6} tile="none" />
    </PageSkeleton>
  );
}
