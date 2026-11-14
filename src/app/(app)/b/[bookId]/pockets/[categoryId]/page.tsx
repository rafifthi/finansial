import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireBookPage } from "@/auth";
import { loadAppData } from "@/lib/data/app-data";
import { SavingsPocket } from "./savings-pocket";
import { SpendingPocket } from "./spending-pocket";

export const metadata: Metadata = { title: "Pockets" };

/** One pocket: Savings ones grow when you save and can have a goal; Needs/Wants ones get a budget each month. */
export default async function PocketPage({ params }: PageProps<"/b/[bookId]/pockets/[categoryId]">) {
  const { bookId, categoryId } = await params;
  const data = await loadAppData(await requireBookPage(bookId));
  const pocket = data.categoryById.get(categoryId);
  if (!pocket || pocket.group === "Income") notFound();
  return pocket.group === "Savings" ? <SavingsPocket data={data} pot={pocket} /> : <SpendingPocket data={data} pocket={pocket} />;
}
