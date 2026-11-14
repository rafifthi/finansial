import { redirect } from "next/navigation";

/** Savings pots are Savings pockets now. */
export default async function SavingsPotRedirect({ params }: PageProps<"/b/[bookId]/savings/[categoryId]">) {
  const { bookId, categoryId } = await params;
  redirect(`/b/${bookId}/pockets/${categoryId}`);
}
