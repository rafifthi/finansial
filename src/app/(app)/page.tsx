import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { currentUser } from "@/auth";
import { LAST_BOOK_COOKIE } from "@/components/app/remember-book";
import { booksOf } from "@/lib/data/registry";
import { START_PAGE_COOKIE, startPath } from "@/lib/start-page";

/**
 * "/" opens the last-used book (else the most recent one, else the books page
 * on first run) at this device's starting page (Settings → Appearance).
 */
export default async function Home() {
  const user = await currentUser();
  if (!user) redirect("/login");
  const books = (await booksOf(user.id)).filter((b) => b.book.status === "active");
  const jar = await cookies();
  const remembered = jar.get(LAST_BOOK_COOKIE)?.value;
  const target = books.find((b) => b.book.id === remembered) ?? books[0];
  redirect(target ? `/b/${target.book.id}${startPath(jar.get(START_PAGE_COOKIE)?.value)}` : "/books");
}
