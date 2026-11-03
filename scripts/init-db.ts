/**
 * Prepares the registry spreadsheet (Users, Books, Memberships, Invites).
 * Safe to run repeatedly. Book spreadsheets are set up by the in-app
 * "New book" wizard, or by `pnpm migrate:multibook` for an existing sheet.
 *
 *   pnpm registry:init
 */
import { requireSheetsEnv } from "./env";
import { getSheetsClient, registrySpreadsheetId } from "@/lib/sheets/client";
import { SheetDb } from "@/lib/sheets/db";
import { REGISTRY_TABLES } from "@/lib/sheets/schema";

async function main() {
  requireSheetsEnv();
  const db = new SheetDb(getSheetsClient(), registrySpreadsheetId(), REGISTRY_TABLES);
  (await db.ensureSchema()).forEach((l) => console.log(`• ${l}`));
  console.log(`✓ Registry ready: https://docs.google.com/spreadsheets/d/${db.spreadsheetId}`);
  if ((await db.readTab("users")).rows.length === 0) {
    console.log('  No users yet. Create the first admin:  pnpm user:add --email you@example.com --name "You"');
  }
}

main().catch((err) => {
  console.error(err?.response?.data?.error ?? err?.message ?? err);
  process.exit(1);
});
