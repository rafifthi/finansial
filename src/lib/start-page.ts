/** Where opening the app lands, per device (a cookie so "/" can redirect without extra reads). */
export const START_PAGE_COOKIE = "finansial_start";

export const START_PAGES = [
  { id: "dashboard", label: "Dashboard", path: "" },
  { id: "catat", label: "Catat", path: "/catat" },
  { id: "transactions", label: "Transactions", path: "/transactions" },
  { id: "budget", label: "Budget", path: "/budget" },
] as const;

export type StartPage = (typeof START_PAGES)[number]["id"];

/** The in-book path for a stored value; anything unknown falls back to the dashboard. */
export const startPath = (value: string | undefined) => START_PAGES.find((p) => p.id === value)?.path ?? "";
