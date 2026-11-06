import { CardSkeleton, HeaderSkeleton, PageSkeleton, RowsSkeleton } from "@/components/app/skeletons";

export default function UsersLoading() {
  return (
    <PageSkeleton label="users">
      <HeaderSkeleton actions={1} />
      <CardSkeleton>
        <RowsSkeleton rows={6} tile="circle" />
      </CardSkeleton>
    </PageSkeleton>
  );
}
