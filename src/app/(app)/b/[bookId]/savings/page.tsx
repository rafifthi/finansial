import { redirect } from "next/navigation";

/** Savings moved into Pockets. */
export default async function SavingsRedirect({ params }: PageProps<"/b/[bookId]/savings">) {
  redirect(`/b/${(await params).bookId}/pockets`);
}
