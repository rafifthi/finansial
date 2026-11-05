# Finansial

Household money tracker whose only databases are Google Sheets you own. Built with Next.js 16, BoardUI, and the Google Sheets API.

- **Books:** each user can have several books, for example a shared **Family** book and a **Personal** one that only its owner can open. Every book lives in its **own spreadsheet**.
- **Transactions:** expenses, income and transfers, each with an account, a household member and a *verified* flag (matched against the bank statement).
- **Reconcile:** tick off unverified rows per account. The verified balance should match the bank's.
- **Budget:** plan income, then allocate it to Savings / Needs / Wants for each period. The **cut-off day** sets where a period ends. Shows non-allocated money and usage per category.
- **Goals:** funded by Savings categories linked to them. Shows the monthly amount needed to hit the target date.
- **Installments:** card plans and loans. Shows *Bulan ke-*, *Lunas* month and "record payment".
- **Recurring:** monthly or weekly rules, booked daily by a cron job (idempotent).
- **Dashboard:** KPIs, spending vs budget trend, Needs/Wants/Savings split, balances, goals, installments due.

**Roles are per book:**

| Role   | Can, in that book |
|--------|-------------------|
| Admin  | Everything, including Members, Book settings and categories |
| Member | Add and edit transactions, budgets, goals, installments, recurring rules; reconcile |
| Viewer | Read-only |

**System admins** can disable logins and reset passwords, but they can't open other people's books.

Every server action re-checks the session and the role in the book it touches. People who aren't members get "not found". The UI only hides what a role can't use.

## Where data lives

| Spreadsheet | Tabs |
|---|---|
| **Registry** (one per deployment, `REGISTRY_SPREADSHEET_ID`) | `Users` (email, name, scrypt password hash, system-admin flag), `Books` (name, kind, spreadsheet id, owner, setup status), `Memberships` (user × book → role, household member), `Invites` |
| **Book** (one per book; the user creates it in Drive) | `Transactions`, `Categories`, `Budgets`, `Goals`, `Installments`, `Recurring`, `Settings` (currency, locale, cut-off day, household members), `_meta` (marks which book owns the sheet) |

- **Schema:** the schema lives in [`src/lib/sheets/schema.ts`](src/lib/sheets/schema.ts).
- **Columns:** they're matched **by name**, so you can reorder them or add your own columns; the app preserves them.
- **Hand edits:** rows edited by hand show up within about 30 seconds.
- **Bad rows:** rows the app can't parse are skipped and listed in **Book settings**.
- **Totals:** balances and totals are always computed from the data, never stored.
- **Per-device settings:** the glass level and dark mode are stored in the browser.

## Setup

### 1. Google Cloud (one time)

1. Create a project at <https://console.cloud.google.com>. Enable the **Google Sheets API** and the **Google Drive API**.
   - The app uses Drive read-only, to check who owns a pasted sheet.
2. **IAM & Admin → Service accounts → Create**, then **Keys → Add key → JSON**.
   - Save the JSON key as `./service-account.json`. It's gitignored.
3. Create a **blank Google Sheet** for the registry and share it with the service account email as **Editor**.

### 2. Configure

```bash
cp .env.example .env.local
```

In `.env.local`, set `REGISTRY_SPREADSHEET_ID`, `AUTH_SECRET` (`npx auth secret`) and `CRON_SECRET`.

### 3. First run

```bash
pnpm install
pnpm registry:init                                  # registry tabs (safe to re-run)
pnpm user:add --email you@gmail.com --name "You"    # first user = system admin; prints a temporary password
pnpm dev
```

Sign in, then follow **New book**. The wizard:

1. **About:** name the book and choose Family or Personal.
2. **Spreadsheet:** create a blank sheet (sheets.new), share it with the service account as **Editor**, and paste the link. Live checks confirm that:
   - Finansial can open it.
   - Finansial can edit it.
   - Your Google account owns it, or can edit it.
   - The sheet is empty.
   - No other book uses it.
3. **History (optional):** start fresh with starter categories, or import an old "Money Management V3" sheet. Share it as **Viewer**; you get a dry-run preview with counts, spending per month and warnings.
4. **Create:** the server re-checks everything, then:
   - Claims the sheet.
   - Creates the tabs.
   - Seeds the categories, or imports your old data.
   - Reads everything back.
   - Opens the book.

   Each step is resumable. A failure shows **Retry from step N**, and nothing is ever added twice.

Invite people from the Family book's **Members** page:

- A new email gets an account with a one-time temporary password.
- An existing user is just added.
- Personal books can't be shared.

### Upgrading from the single-sheet version

If you already have the old `DB_SPREADSHEET_ID` setup:

```bash
# .env.local: add REGISTRY_SPREADSHEET_ID (new blank sheet), keep DB_SPREADSHEET_ID for now
pnpm migrate:multibook --name "Cutez Family"     # registry + Family book + memberships (re-runnable)
pnpm migrate:multibook --drop-users-tab          # once sign-in works: remove password hashes from the book sheet
```

The script keeps user ids, so you stay signed in. When it's done, remove `DB_SPREADSHEET_ID`.

`pnpm db:import --book <bookId> --from <oldSheetId>` runs the importer outside the wizard. Add `--apply` to write.

### Try it without Google

Put this in `.env.local` to run on an in-memory demo (local only):

```
DB_DRIVER=memory
AUTH_SECRET=anything
```

**Demo logins** (all with the password `demo1234`):

| Login | Has |
|---|---|
| `admin@demo.local` | Family and Personal books, system admin |
| `member@demo.local` | Family, as Member |
| `viewer@demo.local` | Family, as Viewer |

**Demo sheet ids for the wizard:**

| Id | Behaves like |
|---|---|
| `demo-empty-<anything>` | a valid blank sheet |
| `demo-viewer`, `demo-notyours`, `demo-hasdata`, `demo-private`, `demo-family` | a sheet that fails one of the checks |
| `demo-old-sheet` | an old sheet to import |

## Deploy (Vercel)

1. Import the repo into Vercel.
2. Set `GOOGLE_SERVICE_ACCOUNT_EMAIL` and `GOOGLE_PRIVATE_KEY` from the JSON key, plus `REGISTRY_SPREADSHEET_ID`, `AUTH_SECRET` and `CRON_SECRET`.
3. Leave out `DB_DRIVER`.

`vercel.json` schedules `/api/cron/recurring` daily at 06:00 WIB. The job runs every active book in turn.

**Quota:** one service account serves every book. Each page uses a single Sheets read, cached for 30 seconds per book, so Google's per-minute quota is fine for a few households.

## Development

```bash
pnpm test        # Vitest: finance math, periods, sheet codec, SheetDb vs a fake Sheets API, importer,
                 # auth/roles, book actions, sheet verification, provisioning
pnpm typecheck
pnpm lint
```

Code map:

- `src/lib/sheets/`: schema (book and registry tables), row codec, and the generic `SheetDb` / `MemoryDb` repositories.
- `src/lib/data/`:
  - `registry.ts`: users, books, memberships.
  - `store.ts`: one cached store per book sheet.
  - `action.ts`: `bookAction` / `userAction` (session, role-in-book, zod, refresh).
  - Also: app data loader, recurring job, demo seed.
- `src/lib/books/`:
  - `verify.ts`: pasted-sheet checks, behind a probe interface.
  - `probe.ts`: the Google probe and the demo probe.
  - `provision.ts`: the resumable setup steps.
  - `starter.ts`: starter categories for fresh books.
- `src/lib/finance/`: pure functions for balances, budgets, periods, goals, installments, recurring.
- `src/lib/import/`: parser and fetcher for the old sheet.
- `src/actions/`: server actions (books, members, account, admin, transactions, budget, entities).
- `src/app/(app)/b/[bookId]/…`: in-book pages. `src/app/(app)/(account)/…`: books, new-book wizard, profile, admin.
- `src/components/app/`: app UI composed from BoardUI components in `src/components/base` (added with `npx boardui@latest add <name>`).
