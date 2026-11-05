/**
 * Parses the old "Money Management V3" spreadsheet (formatted values, as the
 * Sheets API returns with FORMATTED_VALUE) into rows for the new DB tables.
 * Pure: no I/O, deterministic ids so re-running the import never duplicates.
 */
import type { Budget, Category, Installment, Transaction } from "@/lib/sheets/schema";
import { toIsoDate } from "@/lib/sheets/codec";
import { addMonths, dayInMonth } from "@/lib/finance/dates";
import { parseAmount } from "@/lib/finance/money";

export type Grid = string[][];

export interface ReferenceGrids {
  setup: Grid;
  summary: Grid;
  budgeting: Grid;
  spending: Grid;
  goals: Grid;
  mobil: Grid;
  pendingCc: Grid;
}

export interface ImportPlan {
  categories: Category[];
  budgets: Budget[];
  transactions: Transaction[];
  installments: Installment[];
  settings: { key: string; value: string }[];
  warnings: string[];
}

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const MONTH_ALIASES: Record<string, number> = { desember: 11, agustus: 7, oktober: 9, mei: 4, juni: 5, juli: 6, januari: 0, februari: 1, maret: 2, nopember: 10 };

export const slug = (s: string) =>
  s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const clean = (s: string | undefined) => (s ?? "").replace(/\s+/g, " ").trim();
const money = (s: string | undefined) => parseAmount(s ?? "") ?? 0;
const isRef = (s: string) => !s || s.startsWith("#REF") || s.toLowerCase() === "add yours";

/** Small stable hash for ids derived from content. */
function hash(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
}

function monthIndex(name: string): number {
  const n = clean(name).toLowerCase();
  const i = MONTHS.indexOf(n);
  return i >= 0 ? i : (MONTH_ALIASES[n] ?? -1);
}

/** Values under a header cell, wherever the header row is (exports differ in leading blank rows). */
function column(grid: Grid, header: string): string[] {
  const want = header.toLowerCase();
  for (let row = 0; row < Math.min(grid.length, 10); row++) {
    const h = (grid[row] ?? []).findIndex((c) => clean(c).toLowerCase().startsWith(want));
    if (h >= 0) return grid.slice(row + 1).map((r) => clean(r[h])).filter((v) => !isRef(v));
  }
  return [];
}

/** Section rows of the Budgeting matrix: label → 12 monthly amounts (Jan..Dec in columns C..N). */
function budgetingSections(grid: Grid) {
  const sections: Record<"income" | "savings" | "expenses", { label: string; months: number[] }[]> = {
    income: [],
    savings: [],
    expenses: [],
  };
  let current: keyof typeof sections | null = null;
  for (const row of grid) {
    const label = clean(row[1]);
    const lower = label.toLowerCase();
    if (lower === "income sources") current = "income";
    else if (lower === "savings list") current = "savings";
    else if (lower === "budgeting list") current = "expenses";
    else if (lower === "total" || lower.startsWith("grand total") || lower.startsWith("allocated") || lower.startsWith("non-allocated")) {
      if (lower === "total") current = null;
    } else if (current && label && !isRef(label) && !lower.startsWith("sisa")) {
      sections[current].push({ label, months: Array.from({ length: 12 }, (_, i) => money(row[2 + i])) });
    }
  }
  return sections;
}

export function planImport(g: ReferenceGrids, opts: { year: number; now: string }): ImportPlan {
  const warnings: string[] = [];
  const now = opts.now;

  // ── Categories ──────────────────────────────────────────────────────────
  const categories: Category[] = [];
  const addCategory = (name: string, group: Category["group"]) => {
    const id = `cat-${slug(name)}`;
    if (categories.some((c) => c.id === id)) return;
    categories.push({
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
    });
  };
  column(g.setup, "Income Sources").forEach((n) => addCategory(n, "Income"));
  column(g.setup, "Needs").forEach((n) => addCategory(n, "Needs"));
  column(g.setup, "Wants").forEach((n) => addCategory(n, "Wants"));
  column(g.setup, "Savings").forEach((n) => addCategory(n, "Savings"));

  // ── Budgets from the month matrix (also adds categories only found there) ─
  const sections = budgetingSections(g.budgeting);
  sections.income.forEach((r) => addCategory(r.label, "Income"));
  sections.savings.forEach((r) => addCategory(r.label, "Savings"));
  sections.expenses.forEach((r) => addCategory(r.label, "Needs"));
  const catByName = new Map(categories.map((c) => [c.name.toLowerCase(), c]));
  const budgets: Budget[] = [];
  for (const r of [...sections.income, ...sections.savings, ...sections.expenses]) {
    const cat = catByName.get(r.label.toLowerCase())!;
    r.months.forEach((amount, i) => {
      if (amount <= 0) return;
      const month = `${opts.year}-${String(i + 1).padStart(2, "0")}`;
      budgets.push({ id: `bud-${month}-${cat.id}`, month, category_id: cat.id, amount });
    });
  }

  // ── Transactions from Spending ──────────────────────────────────────────
  const transactions: Transaction[] = [];
  const seen = new Map<string, number>();
  for (const row of g.spending) {
    const date = toIsoDate(clean(row[2]));
    const amount = money(row[6]);
    const catName = clean(row[5]);
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || amount <= 0) continue;
    const cat = catByName.get(catName.toLowerCase());
    if (!cat) warnings.push(`Spending ${date} "${clean(row[3])}": unknown category "${catName}", imported uncategorised`);
    const description = clean(row[3]);
    const base = `${date}|${description}|${catName}|${amount}`;
    const n = (seen.get(base) ?? 0) + 1; // same item twice on one day stays two rows
    seen.set(base, n);
    transactions.push({
      id: `imp-${hash(`${base}|${n}`)}`,
      date,
      type: cat?.kind === "income" ? "income" : "expense",
      amount,
      category_id: cat?.id ?? "",
      from_category_id: "",
      member: "",
      description,
      verified: clean(row[1]).toUpperCase() === "TRUE",
      recurring_id: "",
      installment_id: "",
      created_at: now,
      updated_at: now,
      created_by: "import",
      updated_by: "import",
    });
  }

  // ── Goals: a header block per column, e.g. "Travel Goals : Rp.30.000.000 By November 2026".
  // Merged cells arrive either as one multi-line cell or split over the rows above "Month".
  // Each becomes the target of its savings pot; "Now" is what the pot already held.
  const GOAL_CATEGORY_ALIASES: Record<string, string[]> = { house: ["rumah"], dandur: ["dana darurat"], travel: ["travel"] };
  const headerRows = g.goals.slice(0, Math.max(1, g.goals.findIndex((r) => r.some((c) => monthIndex(c) === 0))));
  const width = Math.max(0, ...headerRows.map((r) => r.length));
  for (let col = 0; col < width; col++) {
    const text = clean(headerRows.map((r) => r[col] ?? "").join(" "));
    const m = text.match(/^(.+?)\s+Goals?\s*:\s*Rp\.?\s*([\d.,]+)/i);
    if (!m) continue;
    const name = m[1].trim();
    const target = parseAmount(m[2]) ?? 0;
    const by = text.match(/By\s+([A-Za-z]+)\s+(\d{4})/i);
    const mi = by ? monthIndex(by[1]) : -1;
    const targetDate = by && mi >= 0 ? dayInMonth(`${by[2]}-${String(mi + 1).padStart(2, "0")}`, 31) : "";
    const now = text.match(/Now\s*:\s*Rp\.?\s*([\d.,]+)/i);
    const aliases = GOAL_CATEGORY_ALIASES[name.toLowerCase()] ?? [name.toLowerCase()];
    let pot = categories.find((c) => c.group === "Savings" && aliases.includes(c.name.toLowerCase()));
    if (!pot) {
      addCategory(name, "Savings");
      pot = categories.find((c) => c.id === `cat-${slug(name)}`)!;
      warnings.push(`Goal "${name}": no Savings category matched, so a "${name}" pot was added`);
    }
    pot.target_amount = target;
    pot.target_date = targetDate;
    pot.starting_balance = now ? (parseAmount(now[1]) ?? 0) : 0;
  }

  // ── Installments: Mobil sheet — a schedule of [year?, month, amount paid] rows,
  // with "Cicilan Mobil / Target : 64.900.000" in the title cell when present.
  const installments: Installment[] = [];
  const titleCell = g.mobil.flat().map(clean).find((c) => /Target\s*:/i.test(c)) ?? "";
  const mobilTarget = parseAmount(titleCell.match(/Target\s*:\s*([\d.,]+)/i)?.[1] ?? "") ?? 0;
  const schedule: { month: string; amount: number }[] = [];
  {
    let year = opts.year;
    for (const row of g.mobil) {
      if (/^\d{4}$/.test(clean(row[0]))) year = Number(clean(row[0]));
      const m = clean(row[1]);
      if (/^\d{1,2}$/.test(m) && +m >= 1 && +m <= 12) schedule.push({ month: `${year}-${m.padStart(2, "0")}`, amount: money(row[2]) });
    }
  }
  const paid = schedule.filter((p) => p.amount > 0);
  if (paid.length) {
    const name = titleCell.split(/Target/i)[0].trim() || "Cicilan Mobil";
    const monthly = paid[0].amount;
    const id = `inst-${slug(name)}`;
    const cat = catByName.get(name.toLowerCase());
    const tenor = mobilTarget > 0 ? Math.ceil(mobilTarget / monthly) : schedule.length;
    if (mobilTarget === 0) warnings.push(`${name}: no target found, tenor set to the ${tenor} months listed; check it on the Installments page`);
    installments.push({
      id,
      name,
      category_id: cat?.id ?? "",
      monthly_amount: monthly,
      tenor_months: tenor,
      start_month: paid[0].month,
      total_amount: mobilTarget,
      note: "Imported from the Mobil sheet",
    });
    for (const p of paid) {
      const date = `${p.month}-01`;
      if (date > now.slice(0, 10)) continue;
      transactions.push({
        id: `imp-${hash(`${id}|${p.month}`)}`,
        date,
        type: "expense",
        amount: p.amount,
        category_id: cat?.id ?? "",
        from_category_id: "",
        member: "",
        description: name,
        verified: true,
        recurring_id: "",
        installment_id: id,
        created_at: now,
        updated_at: now,
        created_by: "import",
        updated_by: "import",
      });
    }
  }

  // Pending CC: header rows name a card, item rows hold Total / Bulan ke- / Lunas Bulan.
  let card = "";
  for (const row of g.pendingCc) {
    const first = clean(row[0]);
    if (/^CC\b/i.test(first)) {
      card = first;
      continue;
    }
    if (!first || first.toLowerCase() === "total") continue;
    const perMonth = money(row[1]);
    if (perMonth <= 0) {
      warnings.push(`Pending CC "${first}" (${card}): no amount yet, skipped`);
      continue;
    }
    const current = Number(clean(row[2])) || 1;
    const payoff = clean(row[3]);
    const pm = payoff.match(/([A-Za-z]+)\s+(\d{4})/);
    const payoffMonth = pm && monthIndex(pm[1]) >= 0 ? `${pm[2]}-${String(monthIndex(pm[1]) + 1).padStart(2, "0")}` : "";
    const thisMonth = now.slice(0, 7);
    const start = addMonths(thisMonth, 1 - current);
    const tenor = payoffMonth ? Math.max(1, Number(payoffMonth.slice(0, 4)) * 12 + Number(payoffMonth.slice(5)) - (Number(start.slice(0, 4)) * 12 + Number(start.slice(5))) + 1) : current;
    installments.push({
      id: `inst-${slug(`${card}-${first}`)}`,
      name: first,
      category_id: "",
      monthly_amount: perMonth,
      tenor_months: tenor,
      start_month: start,
      total_amount: 0,
      note: card,
    });
  }

  // ── Settings ────────────────────────────────────────────────────────────
  const settings: { key: string; value: string }[] = [];
  // The old sheet budgets by calendar month, so the cut-off stays at its default (end of month).
  const members = [...new Set(sections.income.map((r) => r.label.split(" ").slice(1).join(" ")).filter(Boolean))];
  if (members.length) settings.push({ key: "members", value: members.join(",") });

  return { categories, budgets, transactions, installments, settings, warnings };
}
