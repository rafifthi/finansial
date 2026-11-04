import { z } from "zod";

/**
 * Single source of truth for the DB spreadsheet. Each table is one tab whose
 * row 1 holds the column names below. Columns are matched by header name, so
 * the order in the sheet is free and extra (user) columns are preserved.
 */

export type ColumnType = "string" | "number" | "boolean" | "date" | "month";

const id = z.string().min(1);
const optId = z.string().default("");
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");
const month = z.string().regex(/^\d{4}-\d{2}$/, "Expected YYYY-MM");
const amount = z.number().nonnegative();

export const TXN_TYPES = ["expense", "income", "transfer"] as const;
export const ACCOUNT_TYPES = ["bank", "ewallet", "cash", "credit_card", "investment"] as const;
export const CATEGORY_GROUPS = ["Needs", "Wants", "Savings", "Income"] as const;
export const FREQUENCIES = ["monthly", "weekly"] as const;
export const ROLES = ["admin", "member", "viewer"] as const;

export const TransactionSchema = z.object({
  id,
  date,
  type: z.enum(TXN_TYPES),
  amount,
  category_id: optId,
  account_id: optId,
  to_account_id: optId,
  member: z.string().default(""),
  description: z.string().default(""),
  verified: z.boolean().default(false),
  recurring_id: optId,
  installment_id: optId,
  created_at: z.string().default(""),
  updated_at: z.string().default(""),
  /** Email of the user who created / last changed the row. */
  created_by: z.string().default(""),
  updated_by: z.string().default(""),
});

export const AccountSchema = z.object({
  id,
  name: z.string().min(1),
  type: z.enum(ACCOUNT_TYPES),
  opening_balance: z.number().default(0),
  archived: z.boolean().default(false),
});

export const CategorySchema = z.object({
  id,
  name: z.string().min(1),
  kind: z.enum(["expense", "income"]),
  group: z.enum(CATEGORY_GROUPS),
  default_account_id: optId,
  goal_id: optId,
  color: z.string().default(""),
  archived: z.boolean().default(false),
});

export const BudgetSchema = z.object({
  id,
  month,
  category_id: id,
  amount,
});

export const GoalSchema = z.object({
  id,
  name: z.string().min(1),
  target_amount: amount,
  target_date: date.or(z.literal("")).default(""),
  starting_amount: z.number().default(0),
  archived: z.boolean().default(false),
});

export const InstallmentSchema = z.object({
  id,
  name: z.string().min(1),
  account_id: optId,
  category_id: optId,
  monthly_amount: amount,
  tenor_months: z.number().int().positive(),
  start_month: month,
  total_amount: z.number().default(0),
  note: z.string().default(""),
});

export const RecurringSchema = z.object({
  id,
  type: z.enum(TXN_TYPES),
  amount,
  category_id: optId,
  account_id: optId,
  to_account_id: optId,
  member: z.string().default(""),
  description: z.string().default(""),
  frequency: z.enum(FREQUENCIES),
  /** Day of month (1–31, clamped to month end) or weekday (0=Sun … 6=Sat). */
  day: z.number().int().min(0).max(31),
  start_date: date,
  end_date: date.or(z.literal("")).default(""),
  last_run: date.or(z.literal("")).default(""),
  installment_id: optId,
});

export const SettingSchema = z.object({
  key: z.string().min(1),
  value: z.string().default(""),
});

export type Transaction = z.infer<typeof TransactionSchema>;
export type Account = z.infer<typeof AccountSchema>;
export type Category = z.infer<typeof CategorySchema>;
export type Budget = z.infer<typeof BudgetSchema>;
export type Goal = z.infer<typeof GoalSchema>;
export type Installment = z.infer<typeof InstallmentSchema>;
export type Recurring = z.infer<typeof RecurringSchema>;
export type Setting = z.infer<typeof SettingSchema>;
export type Role = (typeof ROLES)[number];

export interface TableDef<S extends z.ZodObject = z.ZodObject> {
  tab: string;
  /** Primary key column; Settings is keyed by `key`. */
  key: string;
  columns: Record<string, ColumnType>;
  schema: S;
}

function table<S extends z.ZodObject>(
  tab: string,
  schema: S,
  columns: { [K in keyof z.infer<S> & string]: ColumnType },
  key = "id",
): TableDef<S> {
  return { tab, key, columns, schema };
}

export const TABLES = {
  transactions: table("Transactions", TransactionSchema, {
    id: "string",
    date: "date",
    type: "string",
    amount: "number",
    category_id: "string",
    account_id: "string",
    to_account_id: "string",
    member: "string",
    description: "string",
    verified: "boolean",
    recurring_id: "string",
    installment_id: "string",
    created_at: "string",
    updated_at: "string",
    created_by: "string",
    updated_by: "string",
  }),
  accounts: table("Accounts", AccountSchema, {
    id: "string",
    name: "string",
    type: "string",
    opening_balance: "number",
    archived: "boolean",
  }),
  categories: table("Categories", CategorySchema, {
    id: "string",
    name: "string",
    kind: "string",
    group: "string",
    default_account_id: "string",
    goal_id: "string",
    color: "string",
    archived: "boolean",
  }),
  budgets: table("Budgets", BudgetSchema, {
    id: "string",
    month: "month",
    category_id: "string",
    amount: "number",
  }),
  goals: table("Goals", GoalSchema, {
    id: "string",
    name: "string",
    target_amount: "number",
    target_date: "date",
    starting_amount: "number",
    archived: "boolean",
  }),
  installments: table("Installments", InstallmentSchema, {
    id: "string",
    name: "string",
    account_id: "string",
    category_id: "string",
    monthly_amount: "number",
    tenor_months: "number",
    start_month: "month",
    total_amount: "number",
    note: "string",
  }),
  recurring: table("Recurring", RecurringSchema, {
    id: "string",
    type: "string",
    amount: "number",
    category_id: "string",
    account_id: "string",
    to_account_id: "string",
    member: "string",
    description: "string",
    frequency: "string",
    day: "number",
    start_date: "date",
    end_date: "date",
    last_run: "date",
    installment_id: "string",
  }),
  settings: table("Settings", SettingSchema, { key: "string", value: "string" }, "key"),
  /** Claim marker: which book this spreadsheet belongs to (key/value rows). */
  meta: table("_meta", SettingSchema, { key: "string", value: "string" }, "key"),
} as const;

/* ---- Bill check: verifying a card bill against the records ---- */

export const STATEMENT_STATUSES = ["open", "closed"] as const;
export const LINE_KINDS = ["charge", "installment", "fee", "interest", "payment", "refund"] as const;
export const LINE_STATUSES = ["unmatched", "matched", "ignored"] as const;

export const StatementSchema = z.object({
  id,
  name: z.string().min(1),
  /** The statement's print date; also anchors the matching window. */
  statement_date: date,
  /** The bank's billed total, typed by the user; "" falls back to the lines' sum. */
  total_amount: z.number().nullable().default(null),
  status: z.enum(STATEMENT_STATUSES).default("open"),
  note: z.string().default(""),
  created_at: z.string().default(""),
  created_by: z.string().default(""),
});

export const StatementLineSchema = z.object({
  id,
  statement_id: id,
  position: z.number().int().default(0),
  /** Transaction date from the statement, when it had one. */
  date: z.union([date, z.literal("")]).default(""),
  description: z.string().default(""),
  amount,
  kind: z.enum(LINE_KINDS).default("charge"),
  status: z.enum(LINE_STATUSES).default("unmatched"),
  /** The recorded transaction this line was matched to (or created as). */
  transaction_id: optId,
  /** Book holding that transaction; "" is the bill's own book. */
  transaction_book_id: optId,
});

export type Statement = z.infer<typeof StatementSchema>;
export type StatementLine = z.infer<typeof StatementLineSchema>;
export type LineKind = (typeof LINE_KINDS)[number];

/**
 * Statement tabs live beside the book tables but are served by their own
 * SheetDb, so books created before this module keep loading; the tabs are
 * added the first time a book opens Bill check.
 */
export const STATEMENT_TABLES = {
  statements: table("Bills", StatementSchema, {
    id: "string",
    name: "string",
    statement_date: "date",
    total_amount: "number",
    status: "string",
    note: "string",
    created_at: "string",
    created_by: "string",
  }),
  statement_lines: table("BillLines", StatementLineSchema, {
    id: "string",
    statement_id: "string",
    position: "number",
    date: "date",
    description: "string",
    amount: "number",
    kind: "string",
    status: "string",
    transaction_id: "string",
    transaction_book_id: "string",
  }),
} as const;

export type StatementTables = typeof STATEMENT_TABLES;

/** Any set of tables a SheetDb can serve (book sheet or registry sheet). */
export type TableSet = Record<string, TableDef>;
export type Tables = typeof TABLES;
export type TableName = keyof Tables;
export type RowOf<N extends TableName> = z.infer<Tables[N]["schema"]>;
export type RowIn<T extends TableSet, N extends keyof T> = z.infer<T[N]["schema"]>;

/* ── Registry sheet: who can sign in and which books they can open ─────────── */

export const BOOK_KINDS = ["family", "personal"] as const;
export const BOOK_STATUSES = ["provisioning", "active", "archived", "error"] as const;

/** App users (sign-in accounts), not to be confused with money Accounts. */
export const UserSchema = z.object({
  id,
  email: z.string().trim().toLowerCase().email(),
  name: z.string().trim().min(1),
  /** scrypt hash, see lib/auth/password.ts. Never sent to the browser. */
  password_hash: z.string().min(1),
  /** Global user management only (disable logins, reset passwords); no access to others' books. */
  is_system_admin: z.boolean().default(false),
  disabled: z.boolean().default(false),
  created_at: z.string().default(""),
  last_login_at: z.string().default(""),
});

export const BookSchema = z.object({
  id,
  name: z.string().trim().min(1).max(60),
  kind: z.enum(BOOK_KINDS),
  icon: z.string().default(""),
  spreadsheet_id: z.string().default(""),
  owner_user_id: id,
  status: z.enum(BOOK_STATUSES).default("provisioning"),
  /** Last provisioning step that completed (see lib/books/provision.ts). */
  provision_step: z.string().default(""),
  migrated_from: z.string().default(""),
  created_at: z.string().default(""),
});

export const MembershipSchema = z.object({
  id,
  book_id: id,
  user_id: id,
  role: z.enum(ROLES),
  /** Household member this login is in this book (pre-fills "Member" on new transactions). */
  member: z.string().default(""),
  last_opened_at: z.string().default(""),
  created_at: z.string().default(""),
});

export const InviteSchema = z.object({
  id,
  book_id: id,
  email: z.string().trim().toLowerCase().email(),
  role: z.enum(ROLES),
  invited_by: z.string().default(""),
  created_at: z.string().default(""),
  accepted_at: z.string().default(""),
});

export type User = z.infer<typeof UserSchema>;
export type Book = z.infer<typeof BookSchema>;
export type Membership = z.infer<typeof MembershipSchema>;
export type Invite = z.infer<typeof InviteSchema>;

export const REGISTRY_TABLES = {
  users: table("Users", UserSchema, {
    id: "string",
    email: "string",
    name: "string",
    password_hash: "string",
    is_system_admin: "boolean",
    disabled: "boolean",
    created_at: "string",
    last_login_at: "string",
  }),
  books: table("Books", BookSchema, {
    id: "string",
    name: "string",
    kind: "string",
    icon: "string",
    spreadsheet_id: "string",
    owner_user_id: "string",
    status: "string",
    provision_step: "string",
    migrated_from: "string",
    created_at: "string",
  }),
  memberships: table("Memberships", MembershipSchema, {
    id: "string",
    book_id: "string",
    user_id: "string",
    role: "string",
    member: "string",
    last_opened_at: "string",
    created_at: "string",
  }),
  invites: table("Invites", InviteSchema, {
    id: "string",
    book_id: "string",
    email: "string",
    role: "string",
    invited_by: "string",
    created_at: "string",
    accepted_at: "string",
  }),
} as const;

export type RegistryTables = typeof REGISTRY_TABLES;
export type RegistryTableName = keyof RegistryTables;
export type RegistryRowOf<N extends RegistryTableName> = z.infer<RegistryTables[N]["schema"]>;

export const DEFAULT_SETTINGS: Record<string, string> = {
  currency: "IDR",
  locale: "id-ID",
  /** Last day of each budget period; 31 = end of month (calendar months). */
  cutoff_day: "31",
  members: "",
};
