import Link from "next/link";
import { Chip } from "@/components/base/badges/chip";
import { ROLE_INFO } from "@/lib/auth/roles";
import type { PublicUser } from "@/lib/auth/users";
import { booksOf } from "@/lib/data/registry";
import { BookIcon, KIND_LABEL } from "./book-switcher";
import { Card, EmptyState } from "./card";
import { ThemePreference } from "./theme-preference";
import { StartPagePreference } from "./start-page-preference";
import { PasswordCard, ProfileCard } from "./profile-forms";
import type { SettingsSection } from "./settings-tabs";

/** The Account and Appearance tabs, shared by in-book and account-level Settings. */
export async function personalSections(me: PublicUser): Promise<SettingsSection[]> {
  const books = await booksOf(me.id);
  return [
    {
      id: "account",
      label: "Account",
      content: (
        <>
          <div className="grid gap-4 xl:grid-cols-2">
            <Card title="About you" description={me.email} action={me.is_system_admin ? <Chip color="blue">System admin</Chip> : undefined}>
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
                    <Link
                      href={`/b/${book.id}`}
                      className="flex items-center gap-3 rounded-xl py-3 outline-none hover:bg-background-secondary-hover focus-visible:ring-2 focus-visible:ring-border-focus-ring"
                    >
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
      ),
    },
    {
      id: "appearance",
      label: "Appearance",
      content: (
        <Card title="Appearance" description="Personal to this device and browser.">
          <ThemePreference />
          <div className="max-w-sm">
            <StartPagePreference />
          </div>
        </Card>
      ),
    },
  ];
}
