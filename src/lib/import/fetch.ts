import type { sheets_v4 } from "@googleapis/sheets";
import { quoteTab } from "@/lib/sheets/codec";
import type { Snapshot } from "@/lib/sheets/db";
import type { TableName } from "@/lib/sheets/schema";
import { planImport, type Grid, type ImportPlan, type ReferenceGrids } from "./reference";

/** Tabs of the old "Money Management V3" sheet the importer reads. */
export const REFERENCE_TABS: Record<keyof ReferenceGrids, string> = {
  setup: "⚙️Setup",
  summary: "Summary",
  budgeting: "Budgeting",
  spending: "Spending",
  goals: "Goals",
  mobil: "Mobil",
  pendingCc: "Pending CC",
};

/** The tabs that identify the format; the rest are optional. */
export const REQUIRED_REFERENCE_TABS = [REFERENCE_TABS.setup, REFERENCE_TABS.budgeting, REFERENCE_TABS.spending];

/** Reads the reference sheet (formatted values) and plans the import. */
export async function fetchReferencePlan(
  api: sheets_v4.Sheets,
  spreadsheetId: string,
  opts: { year?: number; now?: string } = {},
): Promise<{ plan: ImportPlan; year: number }> {
  const meta = await api.spreadsheets.get({ spreadsheetId, fields: "sheets.properties.title" });
  const present = new Set((meta.data.sheets ?? []).map((s) => s.properties?.title ?? ""));
  const keys = (Object.keys(REFERENCE_TABS) as (keyof ReferenceGrids)[]).filter((k) => present.has(REFERENCE_TABS[k]));
  const ranges = [...keys.map((k) => quoteTab(REFERENCE_TABS[k])), ...(present.has("Report") ? [`${quoteTab("Report")}!A1:M2`] : [])];
  const res = await api.spreadsheets.values.batchGet({ spreadsheetId, ranges, valueRenderOption: "FORMATTED_VALUE" });
  const values = res.data.valueRanges ?? [];
  const grids = Object.fromEntries(
    (Object.keys(REFERENCE_TABS) as (keyof ReferenceGrids)[]).map((k) => {
      const i = keys.indexOf(k);
      return [k, (i >= 0 ? values[i]?.values ?? [] : []) as Grid];
    }),
  ) as unknown as ReferenceGrids;
  const reportYear = present.has("Report")
    ? (values[keys.length]?.values ?? []).flat().map(String).find((v) => /^\d{4}$/.test(v))
    : undefined;
  const year = opts.year ?? Number(reportYear ?? new Date().getFullYear());
  return { plan: planImport(grids, { year, now: opts.now ?? new Date().toISOString() }), year };
}

export const IMPORT_TABLES = ["accounts", "goals", "categories", "budgets", "installments", "transactions"] as const satisfies TableName[];

/** What the plan would add to a book, given what's already there (ids are deterministic, so re-runs add nothing). */
export function importDelta(plan: ImportPlan, existing: Pick<Snapshot, (typeof IMPORT_TABLES)[number] | "settings">) {
  const tables = IMPORT_TABLES.map((name) => {
    const have = new Set(existing[name].rows.map((r) => String((r.data as { id: string }).id)));
    const rows = (plan[name] as { id: string }[]).filter((r) => !have.has(r.id));
    return { name, rows, skipped: plan[name].length - rows.length };
  });
  const haveSettings = new Map(existing.settings.rows.map((r) => [r.data.key, r.data.value]));
  const settings = plan.settings.filter((s) => haveSettings.get(s.key) !== s.value).map((s) => ({ ...s, exists: haveSettings.has(s.key) }));
  return { tables, settings };
}
