import "server-only";
import type { PublicUser } from "@/lib/auth/users";
import { sheetProbe } from "@/lib/books/probe";
import { verifySheet } from "@/lib/books/verify";
import { registry } from "@/lib/data/registry";
import { usingDemoDb } from "@/lib/data/store";
import { getSheetsClient, serviceAccountEmail } from "@/lib/sheets/client";
import { fetchReferencePlan } from "./fetch";
import { REFERENCE_FIXTURE } from "./fixtures";
import { planImport, type ImportPlan } from "./reference";

const DEMO_SA = "finansial-demo@demo.iam.gserviceaccount.com";
export const saEmail = () => (usingDemoDb() ? DEMO_SA : serviceAccountEmail());

export async function usedSheetIds() {
  return new Set((await registry().fresh("books")).map((b) => b.spreadsheet_id).filter(Boolean));
}

/** Runs the pasted-sheet checks for the signed-in user. */
export async function verifyFor(user: PublicUser, input: string, purpose: "book" | "import", resumingBookId?: string, used?: Set<string>) {
  return verifySheet(sheetProbe(user.email), {
    input,
    purpose,
    userEmail: user.email,
    serviceAccount: saEmail(),
    usedSheetIds: used ?? (await usedSheetIds()),
    resumingBookId,
  });
}

/** Reads the old Money Management sheet into an import plan (the bundled fixture in demo mode). */
export async function loadImportPlan(sheetId: string): Promise<ImportPlan> {
  if (usingDemoDb()) return planImport(REFERENCE_FIXTURE, { year: new Date().getFullYear(), now: new Date().toISOString() });
  return (await fetchReferencePlan(getSheetsClient(), sheetId)).plan;
}
