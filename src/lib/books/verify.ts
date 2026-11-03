import { REQUIRED_REFERENCE_TABS } from "@/lib/import/fetch";

/**
 * Checks a pasted Google Sheet before Finansial writes anything to it. Pure
 * logic over a small "probe" interface, so it runs against the real Google
 * APIs, the demo fakes and unit-test fakes alike.
 */

export type CheckStatus = "pass" | "fail" | "pending";

export interface Check {
  id: "link" | "open" | "edit" | "yours" | "empty" | "unused" | "format";
  label: string;
  status: CheckStatus;
  /** What went wrong and how to fix it (shown under a failed check). */
  detail?: string;
}

export interface SheetVerification {
  ok: boolean;
  sheetId: string | null;
  title?: string;
  checks: Check[];
}

export type ProbeError = { error: "not_found" | "forbidden" | "drive_disabled" | "unknown"; message?: string };

export interface SheetProbe {
  /** Tab titles, and which tabs have any values (empty tabs don't count as data). */
  spreadsheet(id: string): Promise<{ title: string; tabs: { title: string; hasData: boolean }[] } | ProbeError>;
  /** Drive metadata visible to the service account. `writers` is absent when only readable. */
  file(id: string): Promise<{ canEdit: boolean; owners: string[]; writers?: string[] } | ProbeError>;
  /** book_id recorded in the sheet's `_meta` tab, if any. */
  claimedBy(id: string): Promise<string | null>;
}

const SHEET_URL = /\/spreadsheets\/(?:u\/\d+\/)?d\/([a-zA-Z0-9_-]{20,})/;
const BARE_ID = /^[a-zA-Z0-9_-]{25,}$/;

/** Spreadsheet id from a pasted URL (any Sheets link) or a bare id. */
export function parseSheetId(input: string): string | null {
  const s = input.trim();
  const m = s.match(SHEET_URL);
  if (m) return m[1];
  if (BARE_ID.test(s)) return s;
  // Demo-mode ids are short and readable.
  if (/^demo-[a-z0-9-]+$/.test(s)) return s;
  return null;
}

const isError = (x: unknown): x is ProbeError => typeof x === "object" && x !== null && "error" in x;

export interface VerifyInput {
  input: string;
  /** "book": an empty sheet to become a book. "import": an old Money Management sheet to read from. */
  purpose: "book" | "import";
  userEmail: string;
  serviceAccount: string;
  /** Spreadsheet ids already connected to books. */
  usedSheetIds: Set<string>;
  /** When resuming a half-finished book, its own sheet is allowed to be "already set up". */
  resumingBookId?: string;
}

export async function verifySheet(probe: SheetProbe, v: VerifyInput): Promise<SheetVerification> {
  const checks: Check[] = [];
  const add = (c: Check) => (checks.push(c), c.status === "pass");
  const result = (sheetId: string | null, title?: string): SheetVerification => ({
    ok: checks.every((c) => c.status === "pass"),
    sheetId,
    title,
    checks,
  });

  const sheetId = parseSheetId(v.input);
  if (
    !add({
      id: "link",
      label: "Link recognised",
      status: sheetId ? "pass" : "fail",
      detail: sheetId ? undefined : "Paste the address of a Google Sheet (it contains /spreadsheets/d/…).",
    })
  ) {
    return result(null);
  }
  const id = sheetId!;
  const share = v.purpose === "book" ? "Editor" : "Viewer";

  // Can Finansial open it?
  const sheet = await probe.spreadsheet(id);
  if (isError(sheet)) {
    add({
      id: "open",
      label: "Finansial can open it",
      status: "fail",
      detail:
        sheet.error === "not_found" || sheet.error === "forbidden"
          ? `Share the sheet with ${v.serviceAccount} as ${share} (Share button, top right), then check again.`
          : `Google returned an error: ${sheet.message ?? sheet.error}`,
    });
    return result(id);
  }
  add({ id: "open", label: "Finansial can open it", status: "pass" });

  const file = await probe.file(id);
  if (isError(file)) {
    add({
      id: "yours",
      label: "You have access to this file",
      status: "fail",
      detail:
        file.error === "drive_disabled"
          ? "The Google Drive API isn't enabled for this Finansial deployment. Ask its admin to enable it in Google Cloud."
          : `Couldn't read the file's sharing details: ${file.message ?? file.error}`,
    });
    return result(id, sheet.title);
  }

  if (v.purpose === "book") {
    add({
      id: "edit",
      label: "Finansial can edit it",
      status: file.canEdit ? "pass" : "fail",
      detail: file.canEdit ? undefined : `It's shared as Viewer. Change ${v.serviceAccount} to Editor.`,
    });
  }

  const me = v.userEmail.toLowerCase();
  const yours = file.owners.map((e) => e.toLowerCase()).includes(me) || (file.writers ?? []).map((e) => e.toLowerCase()).includes(me);
  add({
    id: "yours",
    label: "You have access to this file",
    status: yours ? "pass" : "fail",
    detail: yours
      ? undefined
      : `${me} isn't an owner${v.purpose === "book" ? " or editor" : ""} of this file. Use a sheet created with your Google account, or sign in to Finansial with the Google email that owns it.`,
  });

  if (v.purpose === "book") {
    const claimed = sheet.tabs.some((t) => t.title === "_meta") ? await probe.claimedBy(id) : null;
    const resuming = Boolean(claimed && v.resumingBookId && claimed === v.resumingBookId);
    if (claimed && !resuming) {
      add({ id: "empty", label: "The sheet is empty", status: "fail", detail: "This sheet is already a Finansial book. Ask its owner to invite you instead." });
    } else {
      const withData = sheet.tabs.filter((t) => t.hasData).map((t) => t.title);
      const empty = resuming || withData.length === 0;
      add({
        id: "empty",
        label: resuming ? "Already prepared for this book" : "The sheet is empty",
        status: empty ? "pass" : "fail",
        detail: empty ? undefined : `It already has data (${withData.slice(0, 3).join(", ")}${withData.length > 3 ? "…" : ""}). Use a blank sheet: sheets.new`,
      });
    }
    const used = v.usedSheetIds.has(id) && !resuming;
    add({
      id: "unused",
      label: "Not used by another book",
      status: used ? "fail" : "pass",
      detail: used ? "Another book already uses this sheet." : undefined,
    });
  } else {
    const titles = new Set(sheet.tabs.map((t) => t.title));
    const missing = REQUIRED_REFERENCE_TABS.filter((t) => !titles.has(t));
    add({
      id: "format",
      label: "Recognised as a Money Management sheet",
      status: missing.length === 0 ? "pass" : "fail",
      detail: missing.length ? `Missing tab(s): ${missing.join(", ")}. Only the "Money Management V3" template can be imported for now.` : undefined,
    });
  }

  return result(id, sheet.title);
}
