import { cx } from "@/utils/cx";

type ClassInput = string | number | bigint | boolean | null | undefined | ClassInput[] | { [key: string]: unknown } | ((...args: never[]) => unknown);

function flatten(input: ClassInput, out: string[]) {
  if (!input) return;
  if (typeof input === "string" || typeof input === "number" || typeof input === "bigint") out.push(String(input));
  else if (Array.isArray(input)) input.forEach((i) => flatten(i, out));
  // Base UI's state-function classNames are resolved by Base UI itself; like clsx, skip them here.
  else if (typeof input === "object") for (const [k, v] of Object.entries(input)) if (v) out.push(k);
}

/**
 * shadcn/blocks.so components import `cn` from here. It takes clsx-style
 * inputs and merges with BoardUI's `cx` (tailwind-merge that knows the
 * composite text styles).
 */
export function cn(...inputs: ClassInput[]): string {
  const out: string[] = [];
  inputs.forEach((i) => flatten(i, out));
  return cx(out.join(" "));
}
