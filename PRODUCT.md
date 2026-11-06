# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

One household: Kanza and Rafif, tracking money in IDR. It is a private tool, and other people join only by invite. Each person has a shared **Family** book and can keep a **Personal** book that only its owner can open. Roles are set per book (Admin, Member, Viewer).

## Product Purpose

Finansial lets the household record expenses, income and transfers, plan budgets and see where the money went. All of it is stored in Google Sheets the household owns. It replaces an older spreadsheet ("Money Management V3") that cleared spending every month, kept budgets in a matrix and broke with `#REF!` errors.

Success means logging a transaction takes almost no effort, and at any point in a period the household knows how much is left in Savings, Needs and Wants.

## Positioning

The household's own Google Sheets are the only database, one spreadsheet per book. Columns are matched by name, edits made by hand appear in the app within about 30 seconds, and totals are always computed from the data rather than stored. The app works on top of sheets the household controls. It does not hold their data.

## Operating Context

- **Phone and desktop count equally.** Quick capture happens on the phone (the Catat tab-bar button, receipts, voice). Longer review sessions happen at a laptop (budget, reconcile, bill check, settings).
- **Capture:** Catat takes typed text, speech (Web Speech API, id-ID) or receipt images. DeepSeek turns them into draft transactions, which must be confirmed before anything is saved.
- **Checking against the bank:** each transaction has a *verified* flag. Reconcile ticks off unverified rows per account. Bill check compares the Jenius credit card bill, read from screenshots or typed in, against records in every book the user can edit.
- **Periods:** a cut-off day sets where each budget period ends.

## Capabilities and Constraints

- **Books:** multiple books per user. A registry spreadsheet holds Users, Books, Memberships and Invites, and each book has its own spreadsheet.
- **Modules:** Dashboard, Transactions, Catat, Budget (income allocated to Savings / Needs / Wants), Goals, Installments (*Bulan ke-*, *Lunas*), Recurring, Lists (checklists for groceries, purchases and chores), Accounts, Reconcile, Bill check, Members, Book settings, and account-level Settings and Profile.
- **Auth:** email and password users with per-book roles. System admins can manage logins but can't open other people's books.
- **Every transaction needs an amount, a category and a description.**
- **Transfers go from one category to another, not between accounts.** Each category is bound to an account, so the two categories decide which accounts the money leaves and lands in.
- **Never auto-save AI output.** Drafts are always confirmed first.
- **AI providers:** DeepSeek for text and vision, with Kimi as the fallback. Claude is never used for these features.
- **Deferred:** assets and net worth.
- **Stack in place:** Next.js 16 with BoardUI (React Aria + Tailwind v4). shadcn and blocks.so are used only for AI surfaces. Rules are in AGENTS.md.

## Brand Commitments

- **Name:** Finansial.
- **Language:** English is the base, with Indonesian words where they are the household's natural term (*Catat*, *Bulan ke-*, *Lunas*). Module names stay short and plain (for example, "Bill check" replaced "Card statements").
- **Catat** is the primary call to action across the app.

## Evidence on Hand

- **Account logos:** `public/logos/`.
- **Data:** real household data lives in the users' Google Sheets. A demo mode (`DB_DRIVER=memory`) serves sample data for previews.
- **No marketing content:** there are no testimonials, customers or public claims, and future work must not invent any. The product is private.

## Product Principles

1. **The sheet is the truth.** Nothing should stop the household from reading, editing or leaving their own spreadsheets.
2. **Capture costs seconds.** Logging should be quicker than not logging, and AI proposes while people confirm.
3. **Always know what's left.** Budget status for the period should be one glance away, never a calculation.
4. **Built for two people, not a market.** Choose the household's real workflows over generic finance-app features.

## Accessibility & Inclusion

Dark mode is first-class because the app is often used at night. Every surface must be checked in dark mode as well as light. Follow WCAG AA as the baseline.
