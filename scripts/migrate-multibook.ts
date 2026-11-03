/**
 * One-time upgrade from the single-sheet setup to multi-book:
 *
 *   1. prepares the registry sheet (REGISTRY_SPREADSHEET_ID)
 *   2. copies users from the old DB sheet's Users tab (same ids, so sessions survive);
 *      the first admin becomes a system admin
 *   3. registers the old DB sheet (DB_SPREADSHEET_ID) as a Family book
 *   4. gives every user a membership with their old role and member name
 *   5. writes the _meta claim into the book sheet
 *
 * Re-running changes nothing. Afterwards remove DB_SPREADSHEET_ID from .env.local.
 *
 *   pnpm migrate:multibook [--name "Cutez Family"]
 *   pnpm migrate:multibook --drop-users-tab     # also delete the old Users tab (password hashes) from the book sheet
 */
import { arg, flag, requireSheetsEnv } from "./env";
import { customAlphabet } from "nanoid";
import { z } from "zod";
import { getSheetsClient, registrySpreadsheetId } from "@/lib/sheets/client";
import { SheetDb } from "@/lib/sheets/db";
import { REGISTRY_TABLES, ROLES, TABLES, type RegistryRowOf, type TableDef } from "@/lib/sheets/schema";

const newId = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 12);

const LegacyUserSchema = z.object({
  id: z.string().min(1),
  email: z.string().trim().toLowerCase().email(),
  name: z.string().min(1),
  role: z.enum(ROLES),
  password_hash: z.string().min(1),
  member: z.string().default(""),
  disabled: z.boolean().default(false),
  created_at: z.string().default(""),
  last_login_at: z.string().default(""),
});
type LegacyUser = z.infer<typeof LegacyUserSchema>;

/** The Users tab as the single-sheet version wrote it. */
const LEGACY_USERS: TableDef<typeof LegacyUserSchema> = {
  tab: "Users",
  key: "id",
  columns: {
    id: "string",
    email: "string",
    name: "string",
    role: "string",
    password_hash: "string",
    member: "string",
    disabled: "boolean",
    created_at: "string",
    last_login_at: "string",
  },
  schema: LegacyUserSchema,
};

async function main() {
  requireSheetsEnv(["REGISTRY_SPREADSHEET_ID", "DB_SPREADSHEET_ID"]);
  const api = getSheetsClient();
  const bookSheetId = process.env.DB_SPREADSHEET_ID!;
  if (bookSheetId === registrySpreadsheetId()) throw new Error("REGISTRY_SPREADSHEET_ID must be a different, new sheet.");

  const reg = new SheetDb(api, registrySpreadsheetId(), REGISTRY_TABLES);
  (await reg.ensureSchema()).forEach((l) => console.log(`• registry: ${l}`));

  const legacy = new SheetDb(api, bookSheetId, { users: LEGACY_USERS });
  const hasUsersTab = (await legacy.tabTitles()).includes("Users");
  const legacyUsers: LegacyUser[] = hasUsersTab ? (await legacy.readTab("users")).rows.map((r) => r.data as LegacyUser) : [];
  console.log(`• found ${legacyUsers.length} user(s) in the old Users tab`);

  const now = new Date().toISOString();
  const regUsers = (await reg.readTab("users")).rows.map((r) => r.data);
  const firstAdmin = legacyUsers.find((u) => u.role === "admin" && !u.disabled) ?? legacyUsers[0];

  // 2. users (same ids → existing sign-in sessions keep working)
  const newUsers = legacyUsers
    .filter((u) => !regUsers.some((r) => r.email === u.email))
    .map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      password_hash: u.password_hash,
      is_system_admin: regUsers.length === 0 && u.id === firstAdmin?.id,
      disabled: u.disabled,
      created_at: u.created_at || now,
      last_login_at: u.last_login_at,
    }));
  await reg.insert("users", newUsers);
  if (newUsers.length) console.log(`• registry: copied ${newUsers.length} user(s)`);
  const allUsers = [...regUsers, ...newUsers];
  const idFor = (email: string) => allUsers.find((u) => u.email === email)!.id;

  // 3. book
  const existing = (await reg.readTab("books")).rows.map((r) => r.data).find((b) => b.spreadsheet_id === bookSheetId);
  let book: RegistryRowOf<"books">;
  if (!existing) {
    const owner = firstAdmin ? idFor(firstAdmin.email) : allUsers[0]?.id;
    if (!owner) throw new Error("No users found. Run pnpm user:add first, or check the old Users tab.");
    book = {
      id: newId(),
      name: arg("name") ?? "Family",
      kind: "family",
      icon: "home",
      spreadsheet_id: bookSheetId,
      owner_user_id: owner,
      status: "active",
      provision_step: "done",
      migrated_from: "",
      created_at: now,
    };
    await reg.insert("books", [book]);
    console.log(`• registry: created book "${book.name}" (${book.id})`);
  } else {
    book = existing;
    console.log(`• book already registered: "${book.name}" (${book.id})`);
  }

  // 4. memberships
  const memberships = (await reg.readTab("memberships")).rows.map((r) => r.data).filter((m) => m.book_id === book.id);
  const newMemberships = legacyUsers
    .filter((u) => !memberships.some((m) => m.user_id === idFor(u.email)))
    .map((u) => ({ id: newId(), book_id: book.id, user_id: idFor(u.email), role: u.role, member: u.member, last_opened_at: "", created_at: now }));
  await reg.insert("memberships", newMemberships);
  if (newMemberships.length) console.log(`• registry: added ${newMemberships.length} membership(s)`);

  // 5. book sheet: current schema (adds _meta, new columns) + claim
  const bookDb = new SheetDb(api, bookSheetId, TABLES);
  (await bookDb.ensureSchema()).forEach((l) => console.log(`• book: ${l}`));
  const meta = new Map((await bookDb.readTab("meta")).rows.map((r) => [r.data.key, r.data.value]));
  if (!meta.has("book_id")) {
    const owner = allUsers.find((u) => u.id === book.owner_user_id);
    await bookDb.insert("meta", [
      { key: "book_id", value: book.id },
      { key: "schema_version", value: "2" },
      { key: "claimed_at", value: now },
      { key: "claimed_by", value: owner?.email ?? "" },
    ]);
    console.log("• book: wrote _meta claim");
  } else if (meta.get("book_id") !== book.id) {
    throw new Error(`This sheet is claimed by another book (${meta.get("book_id")}). Not touching it.`);
  }

  if (hasUsersTab && flag("drop-users-tab")) {
    const missing = legacyUsers.filter((u) => !allUsers.some((r) => r.email === u.email));
    if (missing.length) throw new Error(`Not dropping Users: ${missing.length} user(s) aren't in the registry yet.`);
    await bookDb.deleteTab("Users");
    console.log("• book: deleted the old Users tab");
  } else if (hasUsersTab) {
    console.log("  The old Users tab is still in the book sheet. Once sign-in works, run again with --drop-users-tab.");
  }

  console.log(`\n✓ Done. Open /b/${book.id} — and you can now remove DB_SPREADSHEET_ID from .env.local.`);
}

main().catch((err) => {
  console.error(err?.response?.data?.error ?? err?.message ?? err);
  process.exit(1);
});
