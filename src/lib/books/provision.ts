import type { ImportPlan } from "@/lib/import/reference";
import { importDelta } from "@/lib/import/fetch";
import { DEFAULT_SETTINGS, type Book, type RegistryTables, type Tables } from "@/lib/sheets/schema";
import type { SheetStore } from "@/lib/data/sheet-store";
import { starterRows } from "./starter";

/**
 * Turns a verified, empty spreadsheet into a working book. Every step is
 * idempotent and records itself on the Books row (`provision_step`), so a
 * failure can be retried from where it stopped without duplicating rows.
 */
export const PROVISION_STEPS = [
  { id: "claim", label: "Claim the spreadsheet" },
  { id: "schema", label: "Create tabs and headers" },
  { id: "seed", label: "Add categories and settings" },
  { id: "verify", label: "Read everything back" },
  { id: "done", label: "Open the book" },
] as const;

export type ProvisionStepId = (typeof PROVISION_STEPS)[number]["id"];

export interface ProvisionOptions {
  start: "fresh" | "import";
  /** Old sheet id when importing. */
  importFrom?: string;
  cutoffDay: number;
  currency: string;
  locale: string;
  claimedBy: string;
}

export interface ProvisionDeps {
  registry: SheetStore<RegistryTables>;
  store: SheetStore<Tables>;
  /** Reads the old sheet and plans the import (Google, or a fixture in demo mode). */
  loadImportPlan: (sheetId: string) => Promise<ImportPlan>;
}

export interface ProvisionResult {
  ok: boolean;
  completed: ProvisionStepId[];
  failedStep?: ProvisionStepId;
  error?: string;
  counts?: Record<string, number>;
}

const SETUP_KEYS = { start: "setup_start", importFrom: "setup_import_from", cutoff: "setup_cutoff", currency: "setup_currency", locale: "setup_locale" };

/** Options are remembered in the sheet's _meta so a later retry continues with the same choices. */
export async function rememberedOptions(store: SheetStore<Tables>): Promise<Partial<ProvisionOptions>> {
  const meta = new Map((await store.fresh("meta")).map((r) => [r.key, r.value]));
  return {
    start: meta.get(SETUP_KEYS.start) === "import" ? "import" : meta.has(SETUP_KEYS.start) ? "fresh" : undefined,
    importFrom: meta.get(SETUP_KEYS.importFrom) || undefined,
    cutoffDay: meta.has(SETUP_KEYS.cutoff) ? Number(meta.get(SETUP_KEYS.cutoff)) : undefined,
    currency: meta.get(SETUP_KEYS.currency) || undefined,
    locale: meta.get(SETUP_KEYS.locale) || undefined,
  };
}

export async function provisionBook(deps: ProvisionDeps, book: Book, opts: ProvisionOptions): Promise<ProvisionResult> {
  const { registry, store } = deps;
  const done = PROVISION_STEPS.findIndex((s) => s.id === book.provision_step);
  const completed: ProvisionStepId[] = PROVISION_STEPS.slice(0, done + 1).map((s) => s.id);
  let counts: Record<string, number> | undefined;

  const steps: Record<ProvisionStepId, () => Promise<void>> = {
    async claim() {
      // _meta may not exist yet on a blank sheet.
      await store.db.ensureSchema();
      const meta = new Map((await store.fresh("meta")).map((r) => [r.key, r.value]));
      const owner = meta.get("book_id");
      if (owner && owner !== book.id) throw new Error("This sheet already belongs to another book.");
      const want: Record<string, string> = {
        book_id: book.id,
        schema_version: "2",
        claimed_at: new Date().toISOString(),
        claimed_by: opts.claimedBy,
        [SETUP_KEYS.start]: opts.start,
        [SETUP_KEYS.importFrom]: opts.importFrom ?? "",
        [SETUP_KEYS.cutoff]: String(opts.cutoffDay),
        [SETUP_KEYS.currency]: opts.currency,
        [SETUP_KEYS.locale]: opts.locale,
      };
      await store.insert(
        "meta",
        Object.entries(want)
          .filter(([key]) => !meta.has(key))
          .map(([key, value]) => ({ key, value })),
      );
    },
    async schema() {
      await store.db.ensureSchema();
    },
    async seed() {
      const existing = await store.snapshot();
      const has = (name: "categories", id: string) => existing[name].rows.some((r) => r.data.id === id);
      let members = "";
      if (opts.start === "import" && opts.importFrom) {
        const plan = await deps.loadImportPlan(opts.importFrom);
        const delta = importDelta(plan, existing);
        for (const t of delta.tables) if (t.rows.length) await store.insert(t.name, t.rows as never);
        members = plan.settings.find((s) => s.key === "members")?.value ?? "";
      } else {
        const starter = starterRows(book.kind);
        await store.insert("categories", starter.categories.filter((c) => !has("categories", c.id)));
      }
      const settings = new Set(existing.settings.rows.map((r) => r.data.key));
      const want: Record<string, string> = {
        ...DEFAULT_SETTINGS,
        currency: opts.currency,
        locale: opts.locale,
        cutoff_day: String(opts.cutoffDay),
        members,
      };
      await store.insert(
        "settings",
        Object.entries(want)
          .filter(([key]) => !settings.has(key))
          .map(([key, value]) => ({ key, value })),
      );
    },
    async verify() {
      store.invalidate();
      const snap = await store.snapshot();
      const invalid = Object.entries(snap).flatMap(([table, t]) => t.errors.map((e) => `${table} row ${e.rowNumber}: ${e.message}`));
      if (invalid.length) throw new Error(`${invalid.length} row(s) couldn't be read back, e.g. ${invalid[0]}`);
      counts = Object.fromEntries(Object.entries(snap).map(([table, t]) => [table, t.rows.length]));
    },
    async done() {
      await registry.update("books", book.id, { status: "active" });
    },
  };

  for (const { id } of PROVISION_STEPS) {
    if (completed.includes(id) && id !== "done") continue;
    try {
      await steps[id]();
      completed.push(id);
      await registry.update("books", book.id, { provision_step: id, ...(id === "done" ? {} : { status: "provisioning" as const }) });
    } catch (err) {
      await registry.update("books", book.id, { status: "error" }).catch(() => {});
      return { ok: false, completed, failedStep: id, error: err instanceof Error ? err.message : String(err), counts };
    }
  }
  return { ok: true, completed, counts };
}
