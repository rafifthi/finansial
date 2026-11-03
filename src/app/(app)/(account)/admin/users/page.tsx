import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { currentUser } from "@/auth";
import { AdminUsers, type AdminUserRow } from "@/components/app/admin-users";
import { PageHeader } from "@/components/app/page-header";
import { registry } from "@/lib/data/registry";

export const metadata: Metadata = { title: "All users" };

export default async function AdminUsersPage() {
  const me = await currentUser();
  if (!me?.is_system_admin) notFound();
  const [users, memberships] = await Promise.all([registry().rows("users"), registry().rows("memberships")]);
  const rows: AdminUserRow[] = users
    .map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      disabled: u.disabled,
      isSystemAdmin: u.is_system_admin,
      lastLoginAt: u.last_login_at,
      books: memberships.filter((m) => m.user_id === u.id).length,
    }))
    .sort((a, b) => Number(a.disabled) - Number(b.disabled) || a.name.localeCompare(b.name));

  return (
    <>
      <PageHeader
        title="All users"
        description="Every login on this Finansial. System admins can disable accounts and reset passwords, but can't open other people's books. People are added to books from each book's Members page."
      />
      <AdminUsers users={rows} currentUserId={me.id} />
    </>
  );
}
