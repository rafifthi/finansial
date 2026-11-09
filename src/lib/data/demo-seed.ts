import type {
  Book,
  Budget,
  Category,
  Goal,
  Installment,
  Membership,
  Page,
  PageBlock,
  PageComment,
  Recurring,
  Setting,
  TodoItem,
  TodoList,
  Transaction,
  User,
} from "@/lib/sheets/schema";
import { hashPasswordSync } from "@/lib/auth/password";
import { nodeText, splitJson, type DocNode } from "@/lib/library/blocks";
import { budgetMonth, closeMonthPlan } from "@/lib/finance/budget";
import { addDays, addMonths, dayInMonth, monthOf, monthsEnding, today } from "@/lib/finance/dates";

export const DEMO_PASSWORD = "demo1234";
export const DEMO_USERS = [
  { id: "u-rafif", email: "admin@demo.local", name: "Rafif" },
  { id: "u-kanza", email: "member@demo.local", name: "Kanza" },
  { id: "u-viewer", email: "viewer@demo.local", name: "Accountant" },
] as const;

export const DEMO_FAMILY_SHEET = "demo-family";
export const DEMO_PERSONAL_SHEET = "demo-personal";

/** Demo registry: Rafif owns a Family book (shared with Kanza and a viewer) and a Personal one. */
export function demoRegistrySeed() {
  const hash = hashPasswordSync(DEMO_PASSWORD);
  const users: User[] = DEMO_USERS.map((u, i) => ({
    ...u,
    password_hash: hash,
    is_system_admin: i === 0,
    disabled: false,
    created_at: "",
    last_login_at: "",
  }));
  const book = (id: string, name: string, kind: Book["kind"], sheet: string, icon: string): Book => ({
    id,
    name,
    kind,
    icon,
    spreadsheet_id: sheet,
    owner_user_id: "u-rafif",
    status: "active",
    provision_step: "done",
    migrated_from: "",
    created_at: "",
  });
  const books = [
    book("b-family", "Cutez Family", "family", DEMO_FAMILY_SHEET, "home"),
    book("b-personal", "Rafif Personal", "personal", DEMO_PERSONAL_SHEET, "user"),
  ];
  const m = (id: string, book_id: string, user_id: string, role: Membership["role"], member: string): Membership => ({
    id,
    book_id,
    user_id,
    role,
    member,
    last_opened_at: "",
    created_at: "",
  });
  const memberships = [
    m("m1", "b-family", "u-rafif", "admin", "Rafif"),
    m("m2", "b-family", "u-kanza", "member", "Kanza"),
    m("m3", "b-family", "u-viewer", "viewer", ""),
    m("m4", "b-personal", "u-rafif", "admin", ""),
  ];
  return { users, books, memberships, invites: [] };
}

/** Seed for a demo book spreadsheet, by id. Unknown ids start empty (new books). */
/** A couple of interest and fee corrections on the family book's pots. */
export function demoSavingsSeed(spreadsheetId: string) {
  if (spreadsheetId !== DEMO_FAMILY_SHEET) return {};
  const month = monthOf(today());
  const prev = addMonths(month, -1);
  return {
    adjustments: [
      { id: "adj-1", category_id: "rumah", date: dayInMonth(prev, 28), amount: 186_500, note: "Bunga deposito", created_at: "", created_by: "" },
      { id: "adj-2", category_id: "dana-darurat", date: dayInMonth(prev, 30), amount: -6_500, note: "Biaya admin bank", created_at: "", created_by: "" },
    ],
  };
}

export function demoListSeed(spreadsheetId: string): { lists?: TodoList[]; items?: TodoItem[] } {
  const now = today();
  const list = (id: string, name: string, emoji: string, color: string, position: number): TodoList => ({
    id,
    name,
    emoji,
    color,
    sort: "manual",
    position,
    created_at: "",
    created_by: "",
  });
  let n = 0;
  const item = (list_id: string, title: string, extra: Partial<TodoItem> = {}): TodoItem => ({
    id: `item-${++n}`,
    list_id,
    title,
    note: "",
    deadline: "",
    priority: "",
    repeat: "",
    starred: false,
    done: false,
    position: n * 1024,
    completed_at: "",
    created_at: "",
    created_by: "",
    updated_at: "",
    ...extra,
  });
  if (spreadsheetId === DEMO_PERSONAL_SHEET) {
    return {
      lists: [list("reading", "Reading", "📚", "purple", 1024)],
      items: [item("reading", "Atomic Habits"), item("reading", "The Psychology of Money", { starred: true })],
    };
  }
  if (spreadsheetId !== DEMO_FAMILY_SHEET) return {};
  return {
    lists: [
      list("groceries", "Groceries", "🛒", "lime", 1024),
      list("to-buy", "To buy", "🛍️", "orange", 2048),
      list("chores", "Chores", "🧹", "blue", 3072),
    ],
    items: [
      item("groceries", "Beras 5 kg", { starred: true }),
      item("groceries", "Telur 1 tray"),
      item("groceries", "Susu UHT", { note: "Full cream, 1 L × 6" }),
      item("groceries", "Minyak goreng 2 L"),
      item("groceries", "Bawang merah"),
      item("groceries", "Sabun cuci piring", { done: true, completed_at: `${now}T08:00:00.000Z` }),
      item("to-buy", "Rice cooker baru", { priority: "medium", deadline: addDays(now, 10) }),
      item("to-buy", "Kado ulang tahun Ibu", { priority: "high", starred: true, deadline: addDays(now, 3) }),
      item("to-buy", "Filter air", { deadline: addDays(now, -1) }),
      item("chores", "Bayar PBB", { priority: "high", deadline: now }),
      item("chores", "Servis AC", { deadline: addDays(now, 1) }),
      item("chores", "Ganti sprei", { repeat: "weekly", deadline: addDays(now, 2) }),
      item("chores", "Buang sampah", { repeat: "daily", deadline: now }),
    ],
  };
}

/** A few Library pages for the Family book: house info with a child page, and a how-to. */
export function demoLibrarySeed(spreadsheetId: string): { pages?: Page[]; blocks?: PageBlock[]; comments?: PageComment[] } {
  if (spreadsheetId !== DEMO_FAMILY_SHEET) return {};
  const page = (id: string, title: string, emoji: string, position: number, parent_id = ""): Page => ({
    id,
    parent_id,
    title,
    emoji,
    position,
    version: 1,
    archived: false,
    created_at: "",
    created_by: "admin@demo.local",
    updated_at: `${today()}T09:00:00.000Z`,
    updated_by: "admin@demo.local",
  });
  const t = (text: string, marks?: DocNode["marks"]): DocNode => ({ type: "text", text, ...(marks ? { marks } : {}) });
  const para = (...content: DocNode[]): DocNode => ({ type: "paragraph", content });
  const heading = (level: number, text: string): DocNode => ({ type: "heading", attrs: { level }, content: [t(text)] });
  const bullets = (...items: string[]): DocNode => ({ type: "bulletList", content: items.map((i) => ({ type: "listItem", content: [para(t(i))] })) });
  let n = 0;
  const blocks = (page_id: string, nodes: DocNode[]): PageBlock[] =>
    nodes.map((node, i) => {
      const id = `blk-${++n}`;
      const json = JSON.stringify({ ...node, attrs: { id, ...node.attrs } });
      return { id, page_id, position: (i + 1) * 1024, type: node.type, text: nodeText(node), ...splitJson(json), mentions: "", updated_at: "", updated_by: "" };
    });
  const at = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString();
  const comment = (id: string, page_id: string, extra: Partial<PageComment>): PageComment => ({
    id,
    page_id,
    block_id: "",
    parent_id: "",
    quote: "",
    body: "",
    resolved: false,
    resolved_by: "",
    resolved_at: "",
    deleted: false,
    author_name: "Kanza",
    created_at: at(5),
    created_by: "member@demo.local",
    updated_at: at(5),
    ...extra,
  });
  return {
    comments: [
      comment("cm-1", "house", { block_id: "blk-3", quote: "RT: Pak Budi, 0812 0000 1111 Security post: ext. 21 AC service: Dingin Jaya, 0813 2222 3333", body: "Dingin Jaya has a new number since October, I'll ask them." }),
      comment("cm-2", "house", { parent_id: "cm-1", body: "Thanks! Update it here when you have it.", author_name: "Rafif", created_by: "admin@demo.local", created_at: at(3), updated_at: at(3) }),
      comment("cm-3", "house", { body: "Should we add the plumber here too?", created_at: at(26), updated_at: at(26) }),
    ],
    pages: [page("house", "House info", "🏠", 1024), page("utilities", "Wi-Fi & utilities", "💡", 1024, "house"), page("tax", "Paying PBB", "🧾", 2048)],
    blocks: [
      ...blocks("house", [
        para(t("Everything about the house in one place. Ask in the comments if something's out of date.")),
        heading(2, "Contacts"),
        bullets("RT: Pak Budi, 0812 0000 1111", "Security post: ext. 21", "AC service: Dingin Jaya, 0813 2222 3333"),
        heading(2, "Keys"),
        para(t("Spare keys are in the "), t("blue box", [{ type: "bold" }]), t(" in the study.")),
      ]),
      ...blocks("utilities", [
        heading(2, "Internet"),
        para(t("Provider: IndiHome. Customer number is on the bill.")),
        heading(2, "Electricity"),
        para(t("Prepaid token. Top up "), t("in the PLN app", [{ type: "link", attrs: { href: "https://pln.co.id" } }]), t(" when it drops below 50 kWh.")),
      ]),
      ...blocks("tax", [
        para(t("PBB is due every August.")),
        { type: "orderedList", content: ["Get the SPPT from the RT", "Pay at the bank or in the app", "File the receipt in the blue box"].map((s) => ({ type: "listItem", content: [para(t(s))] })) },
      ]),
    ],
  };
}

export function demoBookSeed(spreadsheetId: string) {
  if (spreadsheetId === DEMO_FAMILY_SHEET) return demoSeed();
  if (spreadsheetId === DEMO_PERSONAL_SHEET) return demoPersonalSeed();
  return {};
}

/**
 * Demo household modelled on the reference "Money Management V3" sheet, used
 * by DB_DRIVER=memory. Deterministic so screenshots and tests are stable.
 */
export function demoSeed() {
  const now = today();
  const thisMonth = monthOf(now);

  const c = (
    id: string,
    name: string,
    group: Category["group"],
    color: string,
    emoji: string,
    goal_id = "",
    starting_balance = 0,
  ): Category => ({
    id,
    name,
    kind: group === "Income" ? "income" : "expense",
    group,
    goal_id,
    starting_balance,
    target_amount: 0,
    target_date: "",
    color,
    emoji,
    archived: false,
    position: 0,
  });

  const categories: Category[] = [
    c("monthly-kanza", "Monthly Kanza", "Income", "lime", "💼"),
    c("bonus-kanza", "Bonus Kanza", "Income", "yellow", "🎁"),
    c("monthly-rafif", "Monthly Rafif", "Income", "cyan", "💼"),
    c("tambal", "Tambal", "Income", "neutral", "🪙"),
    c("billing", "Billing", "Needs", "blue", "🧾"),
    c("kuota", "Kuota", "Needs", "cyan", "📶"),
    c("infaq", "Infaq", "Needs", "lime", "🤲"),
    c("groceries", "Groceries", "Needs", "lime", "🛒"),
    c("transport", "Transport", "Needs", "yellow", "🚗"),
    c("insurance", "Insurance", "Needs", "blue", "🛡️"),
    c("meals", "Meals", "Needs", "orange", "🍜"),
    c("cicilan-mobil", "Cicilan Mobil", "Needs", "neutral", "🚙"),
    c("petty-cash", "Petty Cash", "Wants", "orange", "💸"),
    c("date", "Date", "Wants", "rose", "💕"),
    c("subscription", "Subscription", "Wants", "purple", "📺"),
    c("anak", "Anak", "Savings", "yellow", "👶", "g-anak", 24_000_000),
    c("dana-darurat", "Dana Darurat", "Savings", "rose", "🚨", "g-dandur", 13_000_000),
    c("travel", "Travel", "Savings", "cyan", "✈️", "g-travel", 18_000_000),
    c("rumah", "Rumah", "Savings", "purple", "🏠", "g-house", 28_000_000),
  ];

  const plan: Record<string, number> = {
    "monthly-kanza": 6_000_000,
    "bonus-kanza": 1_150_000,
    "monthly-rafif": 6_000_000,
    billing: 890_333,
    infaq: 216_600,
    groceries: 350_000,
    transport: 2_500_000,
    meals: 1_500_000,
    "cicilan-mobil": 2_000_000,
    "petty-cash": 647_750,
    date: 1_000_000,
    anak: 342_000,
    "dana-darurat": 1_400_000,
    travel: 1_000_000,
    rumah: 800_000,
  };

  const months = monthsEnding(thisMonth, 6);
  const budgets: Budget[] = months.flatMap((m) =>
    Object.entries(plan).map(([category_id, amount]) => ({ id: `b-${m}-${category_id}`, month: m, category_id, amount })),
  );

  let n = 0;
  const tx = (p: Partial<Transaction> & Pick<Transaction, "date" | "amount" | "category_id">): Transaction => ({
    id: `t${++n}`,
    type: "expense",
    from_category_id: "",
    member: "",
    description: "",
    verified: true,
    recurring_id: "",
    installment_id: "",
    created_at: "",
    updated_at: "",
    created_by: "",
    updated_by: "",
    ...p,
  });

  // A pseudo-random but stable sequence for amounts.
  let s = 7;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const meals = ["Nasi Padang", "Tukang Sayur", "Nasi Goreng", "Sourdough", "Ayam Panglima", "TDN", "Mangga + Susu"];
  const rides = ["Gojek CSW", "E-Money", "Gojek Gym → Pitput", "Grab Kantor"];

  const transactions: Transaction[] = [];
  for (const m of months) {
    const last = m === thisMonth ? now : dayInMonth(m, 31);
    const day = (d: number) => {
      const date = dayInMonth(m, d);
      return date <= last ? date : null;
    };
    const push = (d: number, p: Omit<Parameters<typeof tx>[0], "date">) => {
      const date = day(d);
      if (date) transactions.push(tx({ ...p, date, verified: m !== thisMonth || rnd() > 0.35 }));
    };
    push(1, { type: "income", amount: 6_000_000, category_id: "monthly-kanza", member: "Kanza", description: "Gaji" });
    push(1, { type: "income", amount: 6_000_000, category_id: "monthly-rafif", member: "Rafif", description: "Gaji" });
    push(1, { amount: 230_000, category_id: "billing", description: "Gas" });
    push(3, { amount: 333_000, category_id: "billing", description: "Wifi", recurring_id: "r-wifi" });
    push(3, { amount: 100_000, category_id: "billing", description: "IPL" });
    push(5, { amount: 2_000_000, category_id: "cicilan-mobil", description: "Cicilan Mobil", installment_id: "i-mobil" });
    // Payday: savings set aside first.
    push(2, { amount: 1_000_000, category_id: "travel", description: "Tabungan Travel" });
    push(2, { amount: 1_400_000, category_id: "dana-darurat", description: "Dana Darurat" });
    push(2, { amount: 342_000, category_id: "anak", description: "Tabungan Anak" });
    push(2, { amount: 800_000, category_id: "rumah", description: "Tabungan Rumah" });
    push(10, { amount: 216_600, category_id: "infaq", description: "Infaq" });
    for (let d = 2; d <= 30; d += 1) {
      if (rnd() > 0.45) push(d, { amount: Math.round(10_000 + rnd() * 90_000), category_id: "meals", description: meals[d % meals.length] });
      if (rnd() > 0.55) push(d, { amount: Math.round(11_000 + rnd() * 190_000), category_id: "transport", description: rides[d % rides.length] });
      if (d % 7 === 3) push(d, { amount: Math.round(30_000 + rnd() * 150_000), category_id: "date", description: "Bakmi GM" });
      if (d % 9 === 4) push(d, { amount: Math.round(50_000 + rnd() * 200_000), category_id: "petty-cash", description: "Obat Louie" });
      if (d % 11 === 6) push(d, { amount: Math.round(40_000 + rnd() * 120_000), category_id: "groceries", description: "Superindo" });
    }
  }

  // Last month is already closed: its leftovers covered any overspend and went to Rumah,
  // so the dashboard has a month-end sweep to show.
  const lastMonth = addMonths(thisMonth, -1);
  const closed = budgetMonth({ month: lastMonth, budgets, categories, txns: transactions });
  const name = (id: string) => categories.find((c) => c.id === id)?.name ?? "";
  for (const m of closeMonthPlan(closed.lines, "rumah")) {
    transactions.push(
      tx({
        date: dayInMonth(lastMonth, 31),
        type: "transfer",
        amount: m.amount,
        category_id: m.to,
        from_category_id: m.from,
        description: m.reason === "cover" ? `Covers ${name(m.to)} overspend` : `Leftover from ${name(m.from)}`,
      }),
    );
  }

  const goals: Goal[] = [
    { id: "g-travel", name: "Travel", target_amount: 30_000_000, target_date: dayInMonth(addMonths(thisMonth, 1), 30), starting_amount: 18_000_000, archived: false },
    { id: "g-house", name: "House", target_amount: 50_000_000, target_date: dayInMonth(addMonths(thisMonth, 2), 31), starting_amount: 28_000_000, archived: false },
    { id: "g-dandur", name: "Dana Darurat", target_amount: 30_000_000, target_date: "", starting_amount: 13_000_000, archived: false },
    { id: "g-anak", name: "Tabungan Anak", target_amount: 40_000_000, target_date: "", starting_amount: 24_000_000, archived: false },
  ];

  const installments: Installment[] = [
    { id: "i-mobil", name: "Cicilan Mobil", category_id: "cicilan-mobil", monthly_amount: 2_000_000, tenor_months: 33, start_month: months[0], total_amount: 64_900_000, note: "" },
    { id: "i-kai", name: "KAI Berangkat", category_id: "transport", monthly_amount: 450_000, tenor_months: 3, start_month: addMonths(thisMonth, -1), total_amount: 1_350_000, note: "CC CIMB Niaga 0%" },
  ];

  const recurring: Recurring[] = [
    { id: "r-wifi", type: "expense", amount: 333_000, category_id: "billing", from_category_id: "", member: "", description: "Wifi", frequency: "monthly", day: 3, start_date: `${months[0]}-01`, end_date: "", last_run: now, installment_id: "" },
  ];

  const settings: Setting[] = [
    { key: "currency", value: "IDR" },
    { key: "locale", value: "id-ID" },
    { key: "cutoff_day", value: "31" },
    { key: "members", value: "Kanza,Rafif" },
  ];

  return { categories, budgets, transactions, goals, installments, recurring, settings };
}

/** A small single-person book: a few categories and a handful of entries this period. */
function demoPersonalSeed() {
  const now = today();
  const month = monthOf(now);
  const day = (d: number) => dayInMonth(month, d) <= now ? dayInMonth(month, d) : now;
  const c = (id: string, name: string, group: Category["group"]): Category => ({
    id,
    name,
    kind: group === "Income" ? "income" : "expense",
    group,
    goal_id: "",
    starting_balance: 0,
    target_amount: 0,
    target_date: "",
    color: "",
    emoji: "",
    archived: false,
    position: 0,
  });
  const categories = [
    c("p-allowance", "Allowance", "Income"),
    c("p-coffee", "Coffee", "Wants"),
    c("p-hobby", "Hobby", "Wants"),
    c("p-lunch", "Lunch", "Needs"),
    c("p-gadget", "Gadget fund", "Savings"),
  ];
  const t = (id: string, d: number, amount: number, category_id: string, description: string, type: Transaction["type"] = "expense"): Transaction => ({
    id,
    date: day(d),
    type,
    amount,
    category_id,
    from_category_id: "",
    member: "",
    description,
    verified: true,
    recurring_id: "",
    installment_id: "",
    created_at: "",
    updated_at: "",
    created_by: "",
    updated_by: "",
  });
  const transactions = [
    t("p1", 1, 1_500_000, "p-allowance", "Monthly allowance", "income"),
    t("p2", 2, 42_000, "p-coffee", "Kopi Kenangan"),
    t("p3", 2, 35_000, "p-lunch", "Warteg"),
    t("p4", 3, 250_000, "p-hobby", "Climbing gym"),
    t("p5", 3, 300_000, "p-gadget", "Save for headphones"),
  ];
  const budgets: Budget[] = [
    { id: "pb1", month, category_id: "p-allowance", amount: 1_500_000 },
    { id: "pb2", month, category_id: "p-coffee", amount: 300_000 },
    { id: "pb3", month, category_id: "p-lunch", amount: 600_000 },
    { id: "pb4", month, category_id: "p-hobby", amount: 300_000 },
    { id: "pb5", month, category_id: "p-gadget", amount: 300_000 },
  ];
  const settings: Setting[] = [
    { key: "currency", value: "IDR" },
    { key: "locale", value: "id-ID" },
    { key: "cutoff_day", value: "31" },
    { key: "members", value: "" },
  ];
  return { categories, transactions, budgets, settings };
}
