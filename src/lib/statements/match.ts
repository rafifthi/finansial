import { daysBetween } from "@/lib/finance/dates";
import type { Installment, StatementLine, Transaction } from "@/lib/sheets/schema";
import { isCreditKind } from "./parse";

export interface Candidate {
  transaction: Transaction;
  score: number;
}

/** How far before a statement's date its charges can be (a cycle plus slow postings). */
const LOOKBACK_DAYS = 45;
/** Lines with their own date match transactions this many days either side. */
const DATE_SLACK_DAYS = 5;

const STOP = new Set(["the", "and", "dan", "di", "id", "jakarta", "indonesia", "idr", "rp", "pt", "tbk", "com", "www"]);

function tokens(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .split(" ")
      .filter((t) => t.length >= 3 && !STOP.has(t) && !/^\d+$/.test(t)),
  );
}

/** Share of the shorter description's words found in the other, by prefix ("gramedia" ~ "gramedika"). */
export function similarity(a: string, b: string): number {
  const ta = tokens(a);
  const tb = tokens(b);
  if (!ta.size || !tb.size) return 0;
  const [small, big] = ta.size <= tb.size ? [ta, tb] : [tb, ta];
  let hits = 0;
  for (const t of small) {
    for (const u of big) {
      if (t === u || (t.length >= 4 && u.length >= 4 && (t.startsWith(u.slice(0, 4)) || u.startsWith(t.slice(0, 4))))) {
        hits++;
        break;
      }
    }
  }
  return hits / small.size;
}

/**
 * Transactions that could be this line, best first. Any category and any
 * account qualify (purchases on the card are often recorded under the
 * spending category's default account); what must agree is the amount, the
 * direction (charge → expense, refund → income) and roughly the date.
 */
export function candidatesFor(
  line: Pick<StatementLine, "date" | "description" | "amount" | "kind">,
  statementDate: string,
  transactions: Transaction[],
  installments: Pick<Installment, "id" | "name">[] = [],
): Candidate[] {
  const wantType = isCreditKind(line.kind) ? "income" : "expense";
  const installmentName = new Map(installments.map((i) => [i.id, i.name]));
  const out: Candidate[] = [];
  for (const t of transactions) {
    if (t.type !== wantType || t.amount !== line.amount) continue;
    let score = 50;
    if (line.date) {
      const gap = Math.abs(daysBetween(line.date, t.date));
      if (gap > DATE_SLACK_DAYS) continue;
      score += 20 - gap * 4;
    } else if (statementDate) {
      const age = daysBetween(t.date, statementDate);
      if (age < -3 || age > LOOKBACK_DAYS) continue;
    }
    const label = [t.description, installmentName.get(t.installment_id) ?? ""].join(" ");
    score += Math.round(similarity(line.description, label) * 30);
    if (line.kind === "installment" && t.installment_id) score += 15;
    out.push({ transaction: t, score });
  }
  return out.sort((a, b) => b.score - a.score || a.transaction.date.localeCompare(b.transaction.date));
}

/**
 * Picks the matches safe to make without asking: each line takes its best
 * candidate when it is the only one, or clearly ahead of the runner-up,
 * and no transaction is used twice (also against `taken`, transactions
 * already linked by any statement). Lines are settled most-confident first.
 */
export function autoMatch(
  lines: Pick<StatementLine, "id" | "date" | "description" | "amount" | "kind">[],
  statementDate: string,
  transactions: Transaction[],
  taken: Set<string>,
  installments: Pick<Installment, "id" | "name">[] = [],
): Map<string, string> {
  const used = new Set(taken);
  const pool = transactions.filter((t) => !used.has(t.id));
  const ranked = lines
    .map((line) => ({ line, cands: candidatesFor(line, statementDate, pool, installments) }))
    .filter((r) => r.cands.length > 0)
    .sort((a, b) => b.cands[0].score - a.cands[0].score);

  const result = new Map<string, string>();
  for (const { line, cands } of ranked) {
    const open = cands.filter((c) => !used.has(c.transaction.id));
    if (!open.length) continue;
    const [best, next] = open;
    if (next && best.score - next.score < 15) continue;
    result.set(line.id, best.transaction.id);
    used.add(best.transaction.id);
  }
  return result;
}
