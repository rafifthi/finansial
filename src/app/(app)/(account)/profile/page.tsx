import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/auth";
import { BookIcon, KIND_LABEL } from "@/components/app/book-switcher";
import { Card, EmptyState } from "@/components/app/card";
import { PageHeader } from "@/components/app/page-header";
import { PasswordCard, ProfileCard } from "@/components/app/profile-forms";
import { Chip } from "@/components/base/badges/chip";
import { ROLE_INFO } from "@/lib/auth/roles";
import { booksOf } from "@/lib/data/registry";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage() {
  const me = await currentUser();
  if (!me) redirect("/login");
  const books = await booksOf(me.id);

  return (
    <>
      <PageHeader title="Profile" description={me.email} />
      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="About you" action={me.is_system_admin ? <Chip color="blue">System admin</Chip> : undefined}>
          <ProfileCard name={me.name} />
        </Card>
        <Card title="Password">
          <PasswordCard />
        </Card>
      </div>
      <Card title="Your books" description="Your role and household-member name are set per book (Members page).">
        {books.length === 0 ? (
          <EmptyState>No books yet.</EmptyState>
        ) : (
          <ul className="flex flex-col divide-y divide-separator-border">
            {books.map(({ book, membership }) => (
              <li key={book.id}>
                <Link href={`/b/${book.id}`} className="flex items-center gap-3 rounded-xl py-3 outline-none hover:bg-background-secondary-hover focus-visible:ring-2 focus-visible:ring-border-focus-ring">
                  <BookIcon kind={book.kind} />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-body-medium text-text-primary">{book.name}</span>
                    <span className="truncate text-body-2-regular text-text-tertiary">
                      {KIND_LABEL[book.kind]}
                      {membership.member ? ` · you are ${membership.member}` : ""}
                    </span>
                  </span>
                  <Chip variant="caption" color={membership.role === "admin" ? "blue" : "neutral"}>
                    {ROLE_INFO[membership.role].label}
                  </Chip>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
