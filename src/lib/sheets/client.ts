import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { drive, type drive_v3 } from "@googleapis/drive";
import { auth as googleAuth, sheets, type sheets_v4 } from "@googleapis/sheets";

const SCOPES = [
  "https://www.googleapis.com/auth/spreadsheets",
  // Read-only file metadata: who owns a pasted sheet and whether we can edit it.
  "https://www.googleapis.com/auth/drive.metadata.readonly",
];
/** Default location for the downloaded service-account key (gitignored). */
export const DEFAULT_KEY_FILE = "service-account.json";

let client: sheets_v4.Sheets | undefined;
let driveClient: drive_v3.Drive | undefined;
let jwt: InstanceType<typeof googleAuth.JWT> | undefined;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable ${name}. See .env.example.`);
  return value;
}

/**
 * Service-account credentials, from either:
 *  - GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_PRIVATE_KEY (deployments), or
 *  - the downloaded JSON key at GOOGLE_SERVICE_ACCOUNT_KEY_FILE / ./service-account.json (local).
 */
export function serviceAccountCredentials(): { email: string; key: string } | null {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY;
  // Env files usually carry the PEM with escaped newlines.
  if (email && key) return { email, key: key.replace(/\\n/g, "\n") };
  // Local-only key file; the ignore hints keep the bundler from tracing the whole project.
  const file = resolve(/*turbopackIgnore: true*/ process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE ?? DEFAULT_KEY_FILE);
  if (!existsSync(/*turbopackIgnore: true*/ file)) return null;
  const json = JSON.parse(readFileSync(/*turbopackIgnore: true*/ file, "utf8")) as { client_email?: string; private_key?: string };
  if (!json.client_email || !json.private_key) throw new Error(`${file} isn't a service-account key (no client_email/private_key).`);
  return { email: json.client_email, key: json.private_key };
}

function authClient() {
  if (jwt) return jwt;
  const creds = serviceAccountCredentials();
  if (!creds) {
    throw new Error(
      `No service-account credentials. Put the JSON key at ./${DEFAULT_KEY_FILE} or set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY.`,
    );
  }
  return (jwt = new googleAuth.JWT({ email: creds.email, key: creds.key, scopes: SCOPES }));
}

/** Sheets API client authenticated as the service account (server only). */
export function getSheetsClient(): sheets_v4.Sheets {
  return (client ??= sheets({ version: "v4", auth: authClient() }));
}

/** Drive API (metadata only) as the service account. */
export function getDriveClient(): drive_v3.Drive {
  return (driveClient ??= drive({ version: "v3", auth: authClient() }));
}

/** The address people share their sheets with. */
export function serviceAccountEmail(): string {
  return serviceAccountCredentials()?.email ?? "";
}

export const registrySpreadsheetId = () => requireEnv("REGISTRY_SPREADSHEET_ID");
