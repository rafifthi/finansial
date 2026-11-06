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
export const CATEGORY_GROUPS = ["Needs", "Wants", "Savings", "Income"] as const;
export const FREQUENCIES = ["monthly", "weekly"] as const;
export const ROLES = ["admin", "member", "viewer"] as const;

export const TransactionSchema = z.object({
  id,
  date,
  type: z.enum(TXN_TYPES),
  amount,
  /** For a transfer, the destination category; otherwise the category. */
  category_id: optId,
  /** Transfers only: the category the money leaves. */
  from_category_id: optId,
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

export const CategorySchema = z.object({
  id,
  name: z.string().min(1),
  kind: z.enum(["expense", "income"]),
  group: z.enum(CATEGORY_GROUPS),
  /** Legacy: the Goal this pot used to fund. Read only to merge goals into pots. */
  goal_id: optId,
  /** Savings only: what the pot already held before it was tracked here. */
  starting_balance: z.number().default(0),
  /** Savings only: what the pot is saving toward (0 = no target) and by when. */
  target_amount: z.number().nonnegative().default(0),
  target_date: date.or(z.literal("")).default(""),
  /** Identity shown wherever the category appears: a palette name (see category-icon.tsx) and an emoji. */
  color: z.string().default(""),
  emoji: z.string().default(""),
  archived: z.boolean().default(false),
  /** Display order across the app (1, 2, …); 0 keeps the sheet's row order. */
  position: z.number().int().nonnegative().default(0),
});

/** Categories in display order: by position, ties (and unset 0s) in sheet order. */
export function orderCategories<C extends { position: number }>(categories: C[]): C[] {
  return categories
    .map((c, i) => ({ c, i }))
    .sort((a, b) => (a.c.position || 0) - (b.c.position || 0) || a.i - b.i)
    .map(({ c }) => c);
}

/**
 * The full order after rearranging `ids` (a subset, in their new order) among
 * the places they already held; everything else stays where it was.
 */
export function rearrange(order: string[], ids: string[]): string[] {
  const moving = new Set(ids.filter((id) => order.includes(id)));
  const queue = ids.filter((id) => moving.has(id));
  return order.map((id) => (moving.has(id) ? queue.shift()! : id));
}

export const BudgetSchema = z.object({
  id,
  month,
  category_id: id,
  amount,
});

/** Legacy: goals now live on their Savings pot (Category.target_*). Kept to read old books for the merge. */
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
  /** Transfers only: the category the money leaves. */
  from_category_id: optId,
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
    from_category_id: "string",
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
  categories: table("Categories", CategorySchema, {
    id: "string",
    name: "string",
    kind: "string",
    group: "string",
    goal_id: "string",
    starting_balance: "number",
    target_amount: "number",
    target_date: "date",
    color: "string",
    emoji: "string",
    archived: "boolean",
    position: "number",
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
    from_category_id: "string",
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

/* ---- Savings: balance adjustments on a savings pot ---- */

/**
 * A correction to a Savings category's balance with no transaction behind it
 * (interest, fees, a miscount). Signed: positive adds to the pot, negative
 * takes from it. Kept out of Transactions so budgets and spending never see it.
 */
export const SavingsAdjustmentSchema = z.object({
  id,
  category_id: id,
  date,
  amount: z.number().refine((n) => n !== 0, "Enter an amount"),
  note: z.string().trim().min(1, "Say what it's for").max(200),
  created_at: z.string().default(""),
  created_by: z.string().default(""),
});

export type SavingsAdjustment = z.infer<typeof SavingsAdjustmentSchema>;

/** Their own tab, added the first time a book opens Savings. */
export const SAVINGS_TABLES = {
  adjustments: table("SavingsAdjustments", SavingsAdjustmentSchema, {
    id: "string",
    category_id: "string",
    date: "date",
    amount: "number",
    note: "string",
    created_at: "string",
    created_by: "string",
  }),
} as const;

export type SavingsTables = typeof SAVINGS_TABLES;

/* ---- Lists: checklists for groceries, purchases and chores ---- */

export const LIST_SORTS = ["manual", "deadline", "priority", "starred"] as const;
/** "" is no priority. */
export const PRIORITIES = ["", "low", "medium", "high"] as const;
/** "" doesn't repeat. Ticking a repeating item creates the next one (see lib/lists/order.ts). */
export const REPEATS = ["", "daily", "weekly", "monthly", "yearly"] as const;

const lower = <S extends z.ZodType>(s: S) => z.preprocess((v) => (typeof v === "string" ? v.trim().toLowerCase() : v), s);

export const TodoListSchema = z.object({
  id,
  name: z.string().trim().min(1, "Give the list a name").max(60),
  /** Same identity as a category: an emoji on a palette colour (see category-icon.tsx). */
  emoji: z.string().default(""),
  color: z.string().default(""),
  sort: lower(z.enum(LIST_SORTS)).catch("manual"),
  position: z.number().default(0),
  created_at: z.string().default(""),
  created_by: z.string().default(""),
});

export const TodoItemSchema = z.object({
  id,
  list_id: id,
  title: z.string().trim().min(1, "Write something").max(500),
  note: z.string().max(2000).default(""),
  deadline: date.or(z.literal("")).default(""),
  /** Typed by hand as "High" or left blank: anything unknown reads as no priority. */
  priority: lower(z.enum(PRIORITIES)).catch(""),
  repeat: lower(z.enum(REPEATS)).catch(""),
  starred: z.boolean().default(false),
  done: z.boolean().default(false),
  /** Manual order within the list; spaced apart so a move rewrites one row (see lib/lists/order.ts). */
  position: z.number().default(0),
  completed_at: z.string().default(""),
  created_at: z.string().default(""),
  created_by: z.string().default(""),
  updated_at: z.string().default(""),
});

export type TodoList = z.infer<typeof TodoListSchema>;
export type TodoItem = z.infer<typeof TodoItemSchema>;
export type ListSort = (typeof LIST_SORTS)[number];
export type Priority = (typeof PRIORITIES)[number];
export type Repeat = (typeof REPEATS)[number];

/** Their own tabs, added the first time a book opens Lists. */
export const LIST_TABLES = {
  lists: table("Lists", TodoListSchema, {
    id: "string",
    name: "string",
    emoji: "string",
    color: "string",
    sort: "string",
    position: "number",
    created_at: "string",
    created_by: "string",
  }),
  items: table("ListItems", TodoItemSchema, {
    id: "string",
    list_id: "string",
    title: "string",
    note: "string",
    deadline: "date",
    priority: "string",
    repeat: "string",
    starred: "boolean",
    done: "boolean",
    position: "number",
    completed_at: "string",
    created_at: "string",
    created_by: "string",
    updated_at: "string",
  }),
} as const;

export type ListTables = typeof LIST_TABLES;

/** Any set of tables a SheetDb can serve (book sheet or registry sheet). */
export type TableSet = Record<string, TableDef>;
export type Tables = typeof TABLES;
export type TableName = keyof Tables;
export type RowOf<N extends TableName> = z.infer<Tables[N]["schema"]>;
export type RowIn<T extends TableSet, N extends keyof T> = z.infer<T[N]["schema"]>;

/* ── Registry sheet: who can sign in and which books they can open ─────────── */

export const BOOK_KINDS = ["family", "personal"] as const;
export const BOOK_STATUSES = ["provisioning", "active", "archived", "error"] as const;

/** App users (sign-in accounts). */
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
