/**
 * Creates a user in the registry (or resets their password) and prints a
 * temporary password. The first user becomes a system admin. Everyone else
 * is normally added from a book's Members page instead.
 *
 *   pnpm user:add --email you@example.com --name "Rafif" [--book <bookId> --role admin|member|viewer]
 */
import { arg, requireSheetsEnv } from "./env";
import { customAlphabet } from "nanoid";
import { hashPassword, temporaryPassword } from "@/lib/auth/password";
import { normalizeEmail } from "@/lib/auth/users";
import { getSheetsClient, registrySpreadsheetId } from "@/lib/sheets/client";
import { SheetDb } from "@/lib/sheets/db";
import { REGISTRY_TABLES, ROLES, type Role } from "@/lib/sheets/schema";

const newId = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 12);

async function main() {
  requireSheetsEnv();
  const email = normalizeEmail(arg("email") ?? "");
  if (!email.includes("@")) throw new Error('Pass --email, e.g. --email you@example.com --name "Your Name"');
  const role = (arg("role") ?? "admin") as Role;
  if (!ROLES.includes(role)) throw new Error(`--role must be one of ${ROLES.join(", ")}`);
  const bookId = arg("book");

  const reg = new SheetDb(getSheetsClient(), registrySpreadsheetId(), REGISTRY_TABLES);
  await reg.ensureSchema();
  const users = (await reg.readTab("users")).rows.map((r) => r.data);
  const password = temporaryPassword();
  const password_hash = await hashPassword(password);
  let user = users.find((u) => u.email === email);

  if (user) {
    await reg.update("users", user.id, { password_hash, disabled: false });
    console.log(`✓ Reset password for ${email}`);
  } else {
    user = {
      id: newId(),
      email,
      name: arg("name") ?? email.split("@")[0],
      password_hash,
      is_system_admin: users.length === 0,
      disabled: false,
      created_at: new Date().toISOString(),
      last_login_at: "",
    };
    await reg.insert("users", [user]);
    console.log(`✓ Created ${email}${user.is_system_admin ? " (system admin)" : ""}`);
  }

  if (bookId) {
    const book = (await reg.readTab("books")).rows.find((r) => r.data.id === bookId)?.data;
    if (!book) throw new Error(`No book with id ${bookId}`);
    const exists = (await reg.readTab("memberships")).rows.some((r) => r.data.book_id === bookId && r.data.user_id === user!.id);
    if (!exists) {
      await reg.insert("memberships", [
        { id: newId(), book_id: bookId, user_id: user.id, role, member: arg("member") ?? "", last_opened_at: "", created_at: new Date().toISOString() },
      ]);
      console.log(`✓ Added to "${book.name}" as ${role}`);
    }
  }
  console.log(`  Temporary password: ${password}\n  Change it under Profile after signing in.`);
}

main().catch((err) => {
  console.error(err?.response?.data?.error ?? err?.message ?? err);
  process.exit(1);
});
