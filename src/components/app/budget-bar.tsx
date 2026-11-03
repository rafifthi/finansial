import { Meter, type MeterTone } from "@/components/base/meter/meter";
import { formatMoney, type MoneyFormat } from "@/lib/finance/money";
import { cx } from "@/utils/cx";
import { CategoryIcon } from "./category-icon";

export function usageTone(usage: number, isSavings = false): MeterTone {
  if (isSavings) return usage >= 1 ? "success" : "accent";
  if (usage > 1) return "error";
  if (usage >= 0.9) return "warning";
  return "accent";
}

/** One budget line: the category's tile, name, "spent / budget", a meter and what's left. */
export function BudgetBar({
  name,
  category,
  actual,
  budget,
  money,
  isSavings,
}: {
  name: string;
  category?: { emoji: string; color: string; group: string };
  actual: number;
  budget: number;
  money: MoneyFormat;
  isSavings?: boolean;
}) {
  const usage = budget > 0 ? actual / budget : actual > 0 ? 2 : 0;
  const remaining = budget - actual;
  return (
    <div className="flex items-center gap-3">
      {category ? <CategoryIcon name={name} emoji={category.emoji} color={category.color} group={category.group} /> : null}
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-baseline justify-between gap-3">
          <span className="truncate text-body-medium text-text-primary">{name}</span>
          <span className="shrink-0 text-body-2-regular text-text-tertiary tabular-nums">
            {formatMoney(actual, money)} / {formatMoney(budget, money)}
          </span>
        </div>
        <Meter
          aria-label={`${name} budget usage`}
          value={Math.min(usage, 1) * 100}
          tone={usageTone(usage, isSavings)}
          size="sm"
        />
        <span
          className={cx(
            "text-caption-1-medium tabular-nums",
            remaining < 0 && !isSavings ? "text-text-error-primary" : "text-text-tertiary",
          )}
        >
          {budget === 0
            ? "No budget set"
            : remaining >= 0
              ? `${formatMoney(remaining, money)} left · ${Math.round(usage * 100)}%`
              : `${formatMoney(-remaining, money)} over · ${Math.round(usage * 100)}%`}
        </span>
      </div>
    </div>
  );
}
