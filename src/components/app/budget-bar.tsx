import type { MeterTone } from "@/components/base/meter/meter";
import { formatMoney, type MoneyFormat } from "@/lib/finance/money";
import { cx } from "@/utils/cx";
import { CategoryIcon } from "./category-icon";

export function usageTone(usage: number, isSavings = false): MeterTone {
  if (isSavings) return usage >= 1 ? "success" : "accent";
  if (usage > 1) return "error";
  if (usage >= 0.9) return "warning";
  return "accent";
}

const FILL: Record<MeterTone, string> = {
  accent: "bg-button-ghost-foreground",
  success: "bg-notification-success-foreground",
  warning: "bg-chart-8-active",
  error: "bg-notification-error-foreground",
};

/**
 * One budget line: the category's tile, name, "used / budget", a bar and what's
 * left. The bar splits what was really spent from budget moved to savings (and
 * to other categories), so a month-end sweep doesn't read as spending.
 */
export function BudgetBar({
  name,
  category,
  actual,
  spent = actual,
  toSavings = 0,
  budget,
  money,
  isSavings,
}: {
  name: string;
  category?: { emoji: string; color: string; group: string };
  /** Everything that counts against the budget: spending plus budget moved out. */
  actual: number;
  /** Real spending only; defaults to `actual`. */
  spent?: number;
  /** Budget moved to savings pots. */
  toSavings?: number;
  budget: number;
  money: MoneyFormat;
  isSavings?: boolean;
}) {
  const fmt = (n: number) => formatMoney(n, money);
  const usage = budget > 0 ? actual / budget : actual > 0 ? 2 : 0;
  const remaining = budget - actual;
  const saved = Math.max(toSavings, 0);
  // Budget handed to other categories (e.g. covering an overspend); negative when it received some.
  const moved = Math.max(actual - spent - saved, 0);
  const scale = Math.max(budget, actual, 1);
  const pct = (n: number) => `${(Math.max(n, 0) / scale) * 100}%`;
  const spendTone = usageTone(budget > 0 ? spent / budget : spent > 0 ? 2 : 0, isSavings);
  const parts = [
    `${fmt(spent)} spent`,
    saved > 0 && `${fmt(saved)} to savings`,
    moved > 0 && `${fmt(moved)} moved`,
    budget === 0 ? "no budget set" : remaining >= 0 ? `${fmt(remaining)} left` : `${fmt(-remaining)} over`,
  ].filter(Boolean);

  return (
    <div className="flex items-center gap-3">
      {category ? <CategoryIcon name={name} emoji={category.emoji} color={category.color} group={category.group} /> : null}
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-baseline justify-between gap-3">
          <span className="truncate text-body-medium text-text-primary">{name}</span>
          <span className="shrink-0 text-body-2-regular text-text-tertiary tabular-nums">
            {fmt(actual)} / {fmt(budget)}
          </span>
        </div>
        <div
          role="meter"
          aria-label={`${name} budget usage`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(Math.min(usage, 1) * 100)}
          aria-valuetext={parts.join(", ")}
          className="flex h-1.5 w-full gap-px overflow-hidden rounded-full bg-border-button-default"
        >
          <span className={cx("h-full transition-[width] duration-500 motion-reduce:transition-none", FILL[spendTone])} style={{ width: pct(spent) }} />
          {saved > 0 ? <span className="h-full bg-chart-5 transition-[width] duration-500 motion-reduce:transition-none" style={{ width: pct(saved) }} /> : null}
          {moved > 0 ? <span className="h-full bg-foreground-icon-quaternary transition-[width] duration-500 motion-reduce:transition-none" style={{ width: pct(moved) }} /> : null}
        </div>
        <span
          className={cx(
            "truncate text-caption-1-medium tabular-nums",
            remaining < 0 && !isSavings ? "text-text-error-primary" : "text-text-tertiary",
          )}
        >
          {parts.join(" · ")}
        </span>
      </div>
    </div>
  );
}
