import { CardSkeleton, HeaderSkeleton, PageSkeleton, RowsSkeleton } from "@/components/app/skeletons";

export default function ProfileLoading() {
  return (
    <PageSkeleton label="profile">
      <HeaderSkeleton actions={0} />
      <CardSkeleton>
        <RowsSkeleton rows={3} tile="none" />
      </CardSkeleton>
    </PageSkeleton>
  );
}
