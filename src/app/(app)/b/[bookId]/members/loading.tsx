import { CardSkeleton, HeaderSkeleton, PageSkeleton, RowsSkeleton } from "@/components/app/skeletons";

export default function MembersLoading() {
  return (
    <PageSkeleton label="members">
      <HeaderSkeleton actions={1} />
      <CardSkeleton>
        <RowsSkeleton rows={4} tile="circle" />
      </CardSkeleton>
    </PageSkeleton>
  );
}
