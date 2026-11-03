/** Date labels shared by server and client components (timezone-free ISO strings). */
export function monthLabelClient(month: string, locale = "en-GB", style: "long" | "short" = "long") {
  const [y, m] = month.split("-").map(Number);
  return new Intl.DateTimeFormat(locale, { month: style, year: "numeric", timeZone: "UTC" }).format(Date.UTC(y, m - 1, 1));
}

export function shortDateClient(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(Date.UTC(y, m - 1, d));
}
