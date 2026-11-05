import type { Metadata } from "next";
import { requireBookPage } from "@/auth";
import { personalSections } from "@/components/app/account-settings";
import { BookDetails } from "@/components/app/book-details";
import { Card } from "@/components/app/card";
import { CategoryIcon, GROUP_COLOR } from "@/components/app/category-icon";
import { EntityFormButton } from "@/components/app/entity-form";
import { PageHeader } from "@/components/app/page-header";
import { HouseholdSettings, MyMember } from "@/components/app/settings-form";
import { SettingsTabs } from "@/components/app/settings-tabs";
import { Chip } from "@/components/base/badges/chip";
import { loadAdjustments, loadAppData } from "@/lib/data/app-data";
import { savingsBalances } from "@/lib/finance/ledger";
import { formatMoney } from "@/lib/finance/money";
import { fieldSpecs } from "@/lib/data/field-specs";
import { usingDemoDb } from "@/lib/data/store";
import { CATEGORY_GROUPS } from "@/lib/sheets/schema";
import { cx } from "@/utils/cx";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage({ params, searchParams }: PageProps<"/b/[bookId]/settings">) {
  const { group: focus } = await searchParams;
  const ctx = await requireBookPage((await params).bookId);
  const [data, [account, appearance]] = await Promise.all([loadAppData(ctx), personalSections(ctx.user)]);
  const specs = fieldSpecs(data);
  const sheetId = data.book.spreadsheet_id;
  const balances = savingsBalances(data.categories, data.transactions, await loadAdjustments(data));

  const book = (
    <>
      <p className="text-body-regular text-text-secondary">
        Shared with everyone in {data.book.name}. Stored in this book&apos;s own spreadsheet (Settings and Categories tabs).
      </p>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="You in this book">
          <MyMember members={data.members} current={data.membership.member} personal={data.book.kind === "personal"} />
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
                  className="text-button-ghost-foreground underline"
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
    </>
  );

  const categories = (
    <>
      <Card
        id="categories"
        title="Categories"
        description="Group drives the Needs / Wants / Savings split. A Savings category is a pot: it keeps a running balance of everything moved into it."
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
              <Chip color={GROUP_COLOR[group]} className="self-start">
                {group}
              </Chip>
              <ul className="flex flex-col divide-y divide-separator-border">
                {data.categories
                  .filter((c) => c.group === group)
                  .map((c) => (
                    <li key={c.id} className={cx("flex items-center gap-2 py-2", c.archived && "opacity-50")}>
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <CategoryIcon name={c.name} emoji={c.emoji} color={c.color} group={c.group} />
                        <div className="flex min-w-0 flex-1 flex-col">
                          <span className="truncate text-body-medium text-text-primary">{c.name}</span>
                          <span className="truncate text-body-2-regular text-text-tertiary">
                            {[
                              c.group === "Savings" && `Pot ${formatMoney(balances.get(c.id) ?? 0, data.money)}`,
                              c.group === "Savings" && c.target_amount > 0 && `target ${formatMoney(c.target_amount, data.money)}`,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        </div>
                        <EntityFormButton
                          table="categories"
                          title="Category"
                          trigger="icon"
                          fields={specs.categories}
                          money={data.money}
                          initial={c}
                        />
                      </div>
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </div>
      </Card>
    </>
  );

  return (
    <>
      <PageHeader title="Settings" description={`Your account, and preferences for ${data.book.name}.`} />
      <SettingsTabs
        sections={[
          account,
          { id: "book", label: "Book", content: book },
          { id: "categories", label: "Categories", content: categories },
          appearance,
        ]}
      />
    </>
  );
}
