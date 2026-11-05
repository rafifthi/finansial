import { CardSkeleton, HeaderSkeleton, PageSkeleton, RowsSkeleton } from "@/components/app/skeletons";

export default function BooksLoading() {
  return (
    <PageSkeleton label="books">
      <HeaderSkeleton actions={1} />
      <CardSkeleton>
        <RowsSkeleton rows={3} tile="rect" />
      </CardSkeleton>
    </PageSkeleton>
  );
}
