/**
 * Parses human money strings in both en and id styles:
 * "Rp13,150,000", "Rp 13.150.000", "-Rp665,790", "1.234,50", "1500.75".
 * A lone separator followed by exactly three digits is a thousands separator
 * (IDR has no minor unit in practice).
 */
export function parseAmount(input: string): number | undefined {
  const negative = /^\s*[-(]|-\s*rp/i.test(input) || /\)\s*$/.test(input);
  const s = input.replace(/[^0-9.,]/g, "");
  if (!s || !/\d/.test(s)) return undefined;

  const lastDot = s.lastIndexOf(".");
  const lastComma = s.lastIndexOf(",");
  let normalized: string;

  if (lastDot >= 0 && lastComma >= 0) {
    const decimalSep = lastDot > lastComma ? "." : ",";
    const thousandSep = decimalSep === "." ? "," : ".";
    normalized = s.split(thousandSep).join("").replace(decimalSep, ".");
  } else if (lastDot >= 0 || lastComma >= 0) {
    const sep = lastDot >= 0 ? "." : ",";
    const parts = s.split(sep);
    const isThousands = parts.length > 2 || parts[parts.length - 1].length === 3;
    normalized = isThousands ? parts.join("") : parts.join(".");
  } else {
    normalized = s;
  }

  const n = Number(normalized);
  if (Number.isNaN(n)) return undefined;
  return negative ? -n : n;
}

export interface MoneyFormat {
  currency: string;
  locale: string;
}

export const DEFAULT_MONEY_FORMAT: MoneyFormat = { currency: "IDR", locale: "id-ID" };

const formatters = new Map<string, Intl.NumberFormat>();

export function formatMoney(value: number, fmt: MoneyFormat = DEFAULT_MONEY_FORMAT, opts: { compact?: boolean } = {}) {
  const key = `${fmt.locale}|${fmt.currency}|${opts.compact ? 1 : 0}`;
  let f = formatters.get(key);
  if (!f) {
    f = new Intl.NumberFormat(fmt.locale, {
      style: "currency",
      currency: fmt.currency,
      maximumFractionDigits: fmt.currency === "IDR" || opts.compact ? 0 : 2,
      notation: opts.compact ? "compact" : "standard",
    });
    formatters.set(key, f);
  }
  return f.format(value);
}

export function formatPercent(ratio: number, locale = DEFAULT_MONEY_FORMAT.locale) {
  return new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1 }).format(ratio);
}
