import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { currentUser } from "@/auth";
import { LAST_BOOK_COOKIE } from "@/components/app/remember-book";
import { booksOf } from "@/lib/data/registry";

/** "/" opens the last-used book, else the most recent one, else the books page (first-run). */
export default async function Home() {
  const user = await currentUser();
  if (!user) redirect("/login");
  const books = (await booksOf(user.id)).filter((b) => b.book.status === "active");
  const remembered = (await cookies()).get(LAST_BOOK_COOKIE)?.value;
  const target = books.find((b) => b.book.id === remembered) ?? books[0];
  redirect(target ? `/b/${target.book.id}` : "/books");
}
