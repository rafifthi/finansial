import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireBookPage } from "@/auth";
import { MembersManager, type MemberRow } from "@/components/app/members-manager";
import { PageHeader } from "@/components/app/page-header";
import { can } from "@/lib/auth/roles";
import { registry } from "@/lib/data/registry";
import { bookStore } from "@/lib/data/store";

export const metadata: Metadata = { title: "Members" };

export default async function MembersPage({ params }: PageProps<"/b/[bookId]/members">) {
  const ctx = await requireBookPage((await params).bookId);
  if (!can(ctx.membership.role, "users:manage")) notFound();
  const [users, memberships, settings] = await Promise.all([
    registry().rows("users"),
    registry().rows("memberships"),
    bookStore(ctx.book).settings(),
  ]);
  const byId = new Map(users.map((u) => [u.id, u]));
  const members: MemberRow[] = memberships
    .filter((m) => m.book_id === ctx.book.id && byId.has(m.user_id))
    .map((m) => {
      const u = byId.get(m.user_id)!;
      return { userId: u.id, name: u.name, email: u.email, role: m.role, member: m.member, lastLoginAt: u.last_login_at, isOwner: u.id === ctx.book.owner_user_id };
    })
    .sort((a, b) => Number(b.isOwner) - Number(a.isOwner) || a.name.localeCompare(b.name));

  return (
    <>
      <PageHeader title="Members" description={`Who can open ${ctx.book.name}, and what they can do in it.`} />
      <MembersManager
        members={members}
        householdMembers={settings.members.split(",").map((m) => m.trim()).filter(Boolean)}
        currentUserId={ctx.user.id}
        personal={ctx.book.kind === "personal"}
      />
    </>
  );
}
