import "server-only";
import { DEMO_FAMILY_SHEET, DEMO_PERSONAL_SHEET } from "@/lib/data/demo-seed";
import { bookStore, usingDemoDb } from "@/lib/data/store";
import { REQUIRED_REFERENCE_TABS } from "@/lib/import/fetch";
import { getDriveClient, getSheetsClient } from "@/lib/sheets/client";
import { quoteTab } from "@/lib/sheets/codec";
import type { ProbeError, SheetProbe } from "./verify";

type GoogleError = { code?: number; status?: number; errors?: { reason?: string }[]; message?: string; response?: { status?: number; data?: { error?: { status?: string; details?: { reason?: string }[] } } } };

function toProbeError(err: unknown): ProbeError {
  const e = err as GoogleError;
  const status = e.code ?? e.status ?? e.response?.status;
  const reasons = [
    ...(e.errors ?? []).map((x) => x.reason),
    ...(e.response?.data?.error?.details ?? []).map((x) => x.reason),
    e.response?.data?.error?.status,
  ].join(" ");
  if (/accessNotConfigured|SERVICE_DISABLED/i.test(reasons) || /has not been used|is disabled/i.test(e.message ?? "")) {
    return { error: "drive_disabled", message: e.message };
  }
  if (status === 404) return { error: "not_found" };
  if (status === 403) return { error: "forbidden" };
  return { error: "unknown", message: e.message };
}

/** The real thing: Sheets for contents, Drive metadata for sharing. */
export function googleProbe(): SheetProbe {
  const sheets = getSheetsClient();
  const drive = getDriveClient();
  return {
    async spreadsheet(id) {
      try {
        const meta = await sheets.spreadsheets.get({ spreadsheetId: id, fields: "properties.title,sheets.properties.title" });
        const titles = (meta.data.sheets ?? []).map((s) => s.properties?.title ?? "").filter(Boolean);
        const values = await sheets.spreadsheets.values.batchGet({ spreadsheetId: id, ranges: titles.map((t) => `${quoteTab(t)}!A1:Z50`) });
        return {
          title: meta.data.properties?.title ?? "",
          tabs: titles.map((title, i) => ({ title, hasData: (values.data.valueRanges?.[i]?.values ?? []).some((row) => row.some((c) => String(c).trim() !== "")) })),
        };
      } catch (err) {
        return toProbeError(err);
      }
    },
    async file(id) {
      try {
        const res = await drive.files.get({
          fileId: id,
          supportsAllDrives: true,
          fields: "capabilities(canEdit),owners(emailAddress),permissions(emailAddress,role)",
        });
        const writers = res.data.permissions
          ?.filter((p) => ["owner", "writer", "organizer", "fileOrganizer"].includes(p.role ?? ""))
          .map((p) => p.emailAddress ?? "")
          .filter(Boolean);
        return {
          canEdit: Boolean(res.data.capabilities?.canEdit),
          owners: (res.data.owners ?? []).map((o) => o.emailAddress ?? "").filter(Boolean),
          writers,
        };
      } catch (err) {
        return toProbeError(err);
      }
    },
    async claimedBy(id) {
      try {
        const res = await sheets.spreadsheets.values.get({ spreadsheetId: id, range: `${quoteTab("_meta")}!A:B` });
        return (res.data.values ?? []).find((r) => r[0] === "book_id")?.[1] ?? null;
      } catch {
        return null;
      }
    },
  };
}

/**
 * Demo mode (DB_DRIVER=memory): fake sheets named after what they test.
 *   demo-empty… (any suffix) → empty, yours, Editor   · demo-viewer → shared as Viewer
 *   demo-private → not shared · demo-notyours → someone else's · demo-hasdata → not empty
 *   demo-old-sheet → an old Money Management sheet (for import)
 */
export function demoProbe(userEmail: string): SheetProbe {
  const bookTabs = async (id: string) => {
    const snap = await bookStore({ spreadsheet_id: id }).snapshot();
    return Object.entries(snap).map(([name, t]) => ({ title: name === "meta" ? "_meta" : name, hasData: t.rows.length > 0 }));
  };
  return {
    async spreadsheet(id) {
      if (id === "demo-private") return { error: "not_found" };
      if (id === "demo-hasdata") return { title: "Groceries list", tabs: [{ title: "Sheet1", hasData: true }] };
      if (id === "demo-old-sheet") return { title: "2026 Cutez Family - Financial Tracker", tabs: REQUIRED_REFERENCE_TABS.map((title) => ({ title, hasData: true })) };
      if (id === DEMO_FAMILY_SHEET || id === DEMO_PERSONAL_SHEET) return { title: id, tabs: [{ title: "_meta", hasData: true }, ...(await bookTabs(id))] };
      if (id.startsWith("demo-")) {
        const tabs = (await bookTabs(id)).filter((t) => t.hasData);
        return { title: "Untitled spreadsheet", tabs: tabs.length ? tabs : [{ title: "Sheet1", hasData: false }] };
      }
      return { error: "not_found" };
    },
    async file(id) {
      if (id === "demo-viewer") return { canEdit: false, owners: [userEmail] };
      if (id === "demo-notyours") return { canEdit: true, owners: ["someone.else@gmail.com"], writers: ["someone.else@gmail.com"] };
      if (id === "demo-old-sheet") return { canEdit: false, owners: [userEmail] };
      return { canEdit: true, owners: [userEmail], writers: [userEmail] };
    },
    async claimedBy(id) {
      if (id === DEMO_FAMILY_SHEET) return "b-family";
      if (id === DEMO_PERSONAL_SHEET) return "b-personal";
      return (await bookStore({ spreadsheet_id: id }).rows("meta")).find((r) => r.key === "book_id")?.value ?? null;
    },
  };
}

export function sheetProbe(userEmail: string): SheetProbe {
  return usingDemoDb() ? demoProbe(userEmail) : googleProbe();
}
