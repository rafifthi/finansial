import type { Metadata } from "next";
import { requireBookPage } from "@/auth";
import { Card } from "@/components/app/card";
import { EntityFormButton } from "@/components/app/entity-form";
import { PageHeader } from "@/components/app/page-header";
import { GlassPreference } from "@/components/app/glass-preference";
import { BookDetails } from "@/components/app/book-details";
import { HouseholdSettings, MyMember } from "@/components/app/settings-form";
import { ThemeToggle } from "@/components/application/theme/theme-toggle";
import { Chip } from "@/components/base/badges/chip";
import { GROUP_CHIP } from "@/components/app/transactions-view";
import { loadAppData } from "@/lib/data/app-data";
import { fieldSpecs } from "@/lib/data/field-specs";
import { usingDemoDb } from "@/lib/data/store";
import { CATEGORY_GROUPS } from "@/lib/sheets/schema";
import { cx } from "@/utils/cx";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage({ params, searchParams }: PageProps<"/b/[bookId]/settings">) {
  const { group: focus } = await searchParams;
  const data = await loadAppData(await requireBookPage((await params).bookId));
  const specs = fieldSpecs(data);
  const sheetId = data.book.spreadsheet_id;

  return (
    <>
      <PageHeader
        title="Book settings"
        description={`Preferences for ${data.book.name}. Stored in this book's own spreadsheet (Settings and Categories tabs).`}
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="You in this book">
          <MyMember
            members={data.members}
            current={data.membership.member}
            personal={data.book.kind === "personal"}
          />
        </Card>

        <Card title="Household">
          <HouseholdSettings
            today={data.today}
            initial={{
              members: data.members.join(", "),
              cutoff_day: data.cutoffDay,
              currency: data.money.currency,
              locale: data.money.locale,
            }}
          />
        </Card>

        <Card title={data.book.name} description={`${data.book.kind === "personal" ? "Personal book · only you can open it" : "Family book"}`}>
          <BookDetails name={data.book.name} isOwner={data.book.owner_user_id === data.membership.user_id} />
          <p className="text-body-regular text-text-secondary">
            {usingDemoDb() ? (
              <>Running on the in-memory demo database (DB_DRIVER=memory). Changes are lost on restart.</>
            ) : sheetId ? (
              <>
                Connected to{" "}
                <a
                  className="text-accent-600 underline dark:text-accent-400"
                  href={`https://docs.google.com/spreadsheets/d/${sheetId}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  this book&apos;s spreadsheet
                </a>
                . You can edit rows there directly; the app picks changes up within 30 seconds.
              </>
            ) : (
              "No spreadsheet configured."
            )}
          </p>
          {data.invalidRows.length ? (
            <div className="flex flex-col gap-2">
              <p className="text-body-medium text-text-error-primary">
                {data.invalidRows.length} row(s) in the sheet couldn&apos;t be read and are ignored:
              </p>
              <ul className="flex flex-col gap-1 text-body-2-regular text-text-secondary">
                {data.invalidRows.slice(0, 10).map((e) => (
                  <li key={`${e.table}-${e.rowNumber}`}>
                    <span className="text-text-primary">
                      {e.table} row {e.rowNumber}:
                    </span>{" "}
                    {e.message}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <Chip color="lime" className="self-start">
              All rows valid
            </Chip>
          )}
        </Card>
      </div>

      <Card title="Appearance" description="Personal to this device and browser.">
        <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <GlassPreference />
          <ThemeToggle appearance="segmented" />
        </div>
      </Card>

      <Card
        id="categories"
        title="Categories"
        description="Group drives the Needs / Wants / Savings split. Link a Savings category to a goal to track progress."
        action={
          <EntityFormButton
            table="categories"
            title="Category"
            fields={specs.categories}
            money={data.money}
            initial={{ group: CATEGORY_GROUPS.includes(focus as never) ? focus : "Needs" }}
          />
        }
      >
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {CATEGORY_GROUPS.map((group) => (
            <div
              key={group}
              className={cx(
                "flex flex-col gap-2 rounded-2xl",
                focus === group && "bg-background-secondary-default p-3 ring-2 ring-accent-300 dark:ring-accent-700",
              )}
            >
              <Chip color={GROUP_CHIP[group]} className="self-start">
                {group}
              </Chip>
              <ul className="flex flex-col divide-y divide-separator-border">
                {data.categories
                  .filter((c) => c.group === group)
                  .map((c) => (
                    <li key={c.id} className={c.archived ? "flex items-center gap-2 py-2 opacity-50" : "flex items-center gap-2 py-2"}>
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-body-medium text-text-primary">{c.name}</span>
                        <span className="truncate text-body-2-regular text-text-tertiary">
                          {[
                            data.accountById.get(c.default_account_id)?.name,
                            data.goals.find((g) => g.id === c.goal_id)?.name && `→ ${data.goals.find((g) => g.id === c.goal_id)?.name}`,
                          ]
                            .filter(Boolean)
                            .join(" · ") || "—"}
                        </span>
                      </div>
                      <EntityFormButton table="categories" title="Category" trigger="icon" fields={specs.categories} money={data.money} initial={c} />
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}
