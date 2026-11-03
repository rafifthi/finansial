import { describe, expect, it, vi } from "vitest";
import { REFERENCE_FIXTURE } from "@/lib/import/fixtures";
import { planImport } from "@/lib/import/reference";
import { MemoryDb } from "@/lib/sheets/memory-db";
import { REGISTRY_TABLES, type Book, type RegistryTables, type Tables } from "@/lib/sheets/schema";

vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ connection: async () => {} }));

const { createStore } = await import("@/lib/data/sheet-store");
const { provisionBook } = await import("./provision");

const book: Book = {
  id: "b-new",
  name: "Test",
  kind: "family",
  icon: "",
  spreadsheet_id: "sheet-1",
  owner_user_id: "u1",
  status: "provisioning",
  provision_step: "",
  migrated_from: "",
  created_at: "",
};

function setup(opts: { meta?: { key: string; value: string }[] } = {}) {
  const registry = createStore(new MemoryDb<RegistryTables>({ books: [book] }, "reg", REGISTRY_TABLES), "reg");
  const store = createStore(new MemoryDb<Tables>({ meta: opts.meta ?? [] }, "sheet-1"), "sheet-1");
  const loadImportPlan = vi.fn(async () => planImport(REFERENCE_FIXTURE, { year: 2026, now: "2026-11-03T00:00:00.000Z" }));
  return { registry, store, loadImportPlan };
}

const options = { start: "fresh" as const, cutoffDay: 24, currency: "IDR", locale: "id-ID", claimedBy: "me@gmail.com" };
const current = async (deps: ReturnType<typeof setup>) => (await deps.registry.fresh("books"))[0];

describe("provisionBook", () => {
  it("claims, seeds and activates a fresh book", async () => {
    const deps = setup();
    const res = await provisionBook(deps, book, options);
    expect(res).toMatchObject({ ok: true, completed: ["claim", "schema", "seed", "verify", "done"] });
    expect(await current(deps)).toMatchObject({ status: "active", provision_step: "done" });
    const meta = Object.fromEntries((await deps.store.fresh("meta")).map((r) => [r.key, r.value]));
    expect(meta).toMatchObject({ book_id: "b-new", setup_start: "fresh", setup_cutoff: "24" });
    expect((await deps.store.fresh("categories")).some((c) => c.name === "Kids")).toBe(true);
    expect(Object.fromEntries((await deps.store.fresh("settings")).map((r) => [r.key, r.value]))).toMatchObject({ cutoff_day: "24", currency: "IDR" });
  });

  it("resumes after a failure without duplicating anything", async () => {
    const deps = setup();
    const insert = deps.store.insert;
    let fail = true;
    deps.store.insert = (async (name, items) => {
      if (name === "settings" && fail) throw new Error("Quota exceeded");
      return insert(name, items);
    }) as typeof insert;

    const first = await provisionBook(deps, book, options);
    expect(first).toMatchObject({ ok: false, failedStep: "seed", error: "Quota exceeded", completed: ["claim", "schema"] });
    expect(await current(deps)).toMatchObject({ status: "error", provision_step: "schema" });

    fail = false;
    const again = await provisionBook(deps, await current(deps), options);
    expect(again.ok).toBe(true);
    const categories = await deps.store.fresh("categories");
    expect(new Set(categories.map((c) => c.id)).size).toBe(categories.length);
    expect((await deps.store.fresh("meta")).filter((r) => r.key === "book_id")).toHaveLength(1);
  });

  it("imports an old sheet instead of the starter set", async () => {
    const deps = setup();
    const res = await provisionBook(deps, book, { ...options, start: "import", importFrom: "old-sheet", cutoffDay: 31 });
    expect(res.ok).toBe(true);
    expect(deps.loadImportPlan).toHaveBeenCalledWith("old-sheet");
    expect(res.counts?.transactions).toBeGreaterThan(0);
    expect((await deps.store.fresh("categories")).some((c) => c.id.startsWith("starter-"))).toBe(false);
    // Re-running the import step is a no-op thanks to deterministic ids.
    const before = (await deps.store.fresh("transactions")).length;
    await provisionBook(deps, { ...book, provision_step: "schema" }, { ...options, start: "import", importFrom: "old-sheet" });
    expect((await deps.store.fresh("transactions")).length).toBe(before);
  });

  it("refuses a sheet claimed by another book", async () => {
    const deps = setup({ meta: [{ key: "book_id", value: "someone-else" }] });
    const res = await provisionBook(deps, book, options);
    expect(res).toMatchObject({ ok: false, failedStep: "claim" });
    expect((await deps.store.fresh("categories")).length).toBe(0);
  });
});
