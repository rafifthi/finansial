import { redirect } from "next/navigation";
import { currentUser } from "@/auth";
import { AppShell } from "@/components/app/app-shell";

/** Pages that aren't inside a book: books list, new-book wizard, profile, admin. */
export default async function AccountLayout({ children }: LayoutProps<"/">) {
  const user = await currentUser();
  if (!user) redirect("/login");
  return <AppShell user={user}>{children}</AppShell>;
}
