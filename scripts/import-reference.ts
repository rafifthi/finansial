/**
 * Imports an old "Money Management V3" sheet into a book. Read-only on the
 * old sheet; re-runnable (rows already in the book are skipped). The in-app
 * "New book" wizard does the same thing with a preview.
 *
 *   pnpm db:import --book <bookId> [--from <oldSheetId>] [--year 2026]   # dry run
 *   pnpm db:import --book <bookId> --apply
 */
import { arg, flag, requireSheetsEnv } from "./env";
import { fetchReferencePlan, importDelta } from "@/lib/import/fetch";
import { getSheetsClient, registrySpreadsheetId } from "@/lib/sheets/client";
import { SheetDb } from "@/lib/sheets/db";
import { REGISTRY_TABLES, TABLES } from "@/lib/sheets/schema";

async function main() {
  requireSheetsEnv();
  const bookId = arg("book");
  const from = arg("from") ?? process.env.REFERENCE_SPREADSHEET_ID;
  if (!bookId) throw new Error("Pass --book <bookId> (see the URL: /b/<bookId>).");
  if (!from) throw new Error("Pass --from <old sheet id> (or set REFERENCE_SPREADSHEET_ID).");
  const apply = flag("apply");

  const api = getSheetsClient();
  const book = (await new SheetDb(api, registrySpreadsheetId(), REGISTRY_TABLES).readTab("books")).rows.find((r) => r.data.id === bookId)?.data;
  if (!book) throw new Error(`No book with id ${bookId}.`);

  const year = arg("year") ? Number(arg("year")) : undefined;
  const { plan, year: usedYear } = await fetchReferencePlan(api, from, { year });
  const db = new SheetDb(api, book.spreadsheet_id, TABLES);
  const delta = importDelta(plan, await db.readAll());

  console.log(`Importing into "${book.name}" · reference year ${usedYear}${apply ? "" : "   (dry run — pass --apply to write)"}\n`);
  for (const t of delta.tables) {
    console.log(`${t.name.padEnd(13)} ${String(t.rows.length).padStart(4)} new   ${String(t.skipped).padStart(4)} already there`);
    if (apply && t.rows.length) await db.insert(t.name, t.rows as never);
  }
  for (const s of delta.settings) {
    console.log(`setting      ${s.key} = ${s.value}`);
    if (apply) {
      if (s.exists) await db.update("settings", s.key, { value: s.value });
      else await db.insert("settings", [{ key: s.key, value: s.value }]);
    }
  }
  if (plan.warnings.length) {
    console.log(`\n${plan.warnings.length} warning(s):`);
    plan.warnings.forEach((w) => console.log(`  ! ${w}`));
  }
  console.log(apply ? "\n✓ Import written." : "\nNothing written.");
}

main().catch((err) => {
  console.error(err?.response?.data?.error ?? err?.message ?? err);
  process.exit(1);
});
