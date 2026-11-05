import { redirect } from "next/navigation";

/** Goals became targets on savings pots; old links land on Savings. */
export default async function GoalsPage({ params }: PageProps<"/b/[bookId]/goals">) {
  redirect(`/b/${(await params).bookId}/savings`);
}
