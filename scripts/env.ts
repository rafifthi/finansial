// Loads env the same way `next dev` does for local scripts (.env.local wins).
import { config } from "dotenv";
import { DEFAULT_KEY_FILE, serviceAccountCredentials } from "@/lib/sheets/client";

config({ path: [".env.local", ".env"], quiet: true });

/** Exits with a readable checklist when the Google Sheets settings aren't filled in. */
export function requireSheetsEnv(names: string[] = ["REGISTRY_SPREADSHEET_ID"]) {
  const missing = names.filter((name) => !process.env[name]);
  if (!serviceAccountCredentials()) missing.unshift(`service-account key (./${DEFAULT_KEY_FILE})`);
  if (missing.length === 0) return;
  console.error(`Missing in .env.local: ${missing.join(", ")}\n`);
  console.error("This script talks to the real Google Sheet (it doesn't use DB_DRIVER=memory).");
  console.error("See README → Setup: create a service account, share a blank sheet with it as Editor,");
  console.error(`then save the downloaded JSON key as ./${DEFAULT_KEY_FILE} and put the sheet IDs in .env.local.`);
  process.exit(1);
}

/** `--name value` from the command line. */
export function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

export const flag = (name: string) => process.argv.includes(`--${name}`);
