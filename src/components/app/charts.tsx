"use client";

import { useState } from "react";
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatMoney, type MoneyFormat } from "@/lib/finance/money";

const GROUP_COLORS: Record<string, string> = {
  Needs: "var(--color-chart-6)",
  Wants: "var(--color-chart-8)",
  Savings: "var(--color-chart-5)",
};

/** Needs / Wants / Savings donut with a centre readout that follows hover. */
export function GroupDonut({
  data,
  money,
}: {
  data: { group: string; value: number }[];
  money: MoneyFormat;
}) {
  const [active, setActive] = useState<number | null>(null);
  const total = data.reduce((s, d) => s + d.value, 0);
  const shown = active !== null ? data[active] : null;
  return (
    // Container query: side-by-side only when the card itself is wide enough.
    <div className="@container">
    <div className="flex flex-col items-center gap-4 @sm:flex-row">
      <div className="relative size-44 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={total > 0 ? data : [{ group: "Empty", value: 1 }]}
              dataKey="value"
              nameKey="group"
              innerRadius="68%"
              outerRadius="100%"
              paddingAngle={total > 0 ? 2 : 0}
              stroke="none"
              onMouseEnter={(_, i) => setActive(i)}
              onMouseLeave={() => setActive(null)}
              isAnimationActive
            >
              {(total > 0 ? data : [{ group: "Empty" }]).map((d) => (
                <Cell key={d.group} fill={GROUP_COLORS[d.group] ?? "var(--color-chart-track)"} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-body-2-medium text-text-tertiary">{shown?.group ?? "Total out"}</span>
          <span className="text-headline-semibold text-text-primary tabular-nums">
            {formatMoney(shown?.value ?? total, money, { compact: true })}
          </span>
        </div>
      </div>
      <dl className="flex w-full flex-col gap-2">
        {data.map((d) => (
          <div key={d.group} className="flex items-center justify-between gap-3">
            <dt className="flex items-center gap-2 text-body-medium text-text-secondary">
              <span className="size-2.5 rounded-full" style={{ background: GROUP_COLORS[d.group] }} aria-hidden />
              {d.group}
            </dt>
            <dd className="flex items-baseline gap-2 tabular-nums">
              <span className="text-body-medium text-text-primary">{formatMoney(d.value, money)}</span>
              <span className="w-12 text-end text-body-2-regular text-text-tertiary">
                {total > 0 ? `${Math.round((d.value / total) * 100)}%` : "—"}
              </span>
            </dd>
          </div>
        ))}
      </dl>
    </div>
    </div>
  );
}

/**
 * Monthly spending against what stayed unspent, newest month on the right.
 * Unspent stacks what went to savings under the rest of the income.
 */
export function TrendChart({
  data,
  money,
}: {
  data: { label: string; spent: number; saved: number; rest: number; income: number }[];
  money: MoneyFormat;
}) {
  const [active, setActive] = useState<number | null>(null);
  const point = active !== null ? data[active] : data[data.length - 1];
  const unspent = (point?.saved ?? 0) + (point?.rest ?? 0);
  const legend = [
    { label: "Spent", className: "bg-accent-solid" },
    { label: "Saved", className: "bg-chart-5" },
    { label: "Not spent", className: "bg-chart-neutral" },
  ];
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-body-2-medium text-text-tertiary">{point?.label}</span>
          <span className="text-title-2-medium text-text-primary tabular-nums">{formatMoney(point?.spent ?? 0, money)} spent</span>
          <span className="text-body-2-regular text-text-tertiary tabular-nums">
            {formatMoney(unspent, money)} unspent · {formatMoney(point?.saved ?? 0, money)} saved
          </span>
        </div>
        <dl className="flex flex-wrap items-center gap-4 text-body-2-medium text-text-secondary">
          {legend.map((l) => (
            <div key={l.label} className="flex items-center gap-1.5">
              <span className={`size-2 rounded-full ${l.className}`} aria-hidden />
              <dt>{l.label}</dt>
            </div>
          ))}
        </dl>
      </div>
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
            barCategoryGap="28%"
            barGap={3}
            onMouseMove={(s) => {
              const i = Number(s?.activeTooltipIndex);
              if (s?.isTooltipActive && Number.isFinite(i)) setActive(i);
            }}
            onMouseLeave={() => setActive(null)}
          >
            <YAxis
              width={48}
              tickCount={4}
              tickFormatter={(v: number) => formatMoney(v, money, { compact: true }).replace(/^Rp\s?/, "")}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 12, fill: "var(--color-text-tertiary)" }}
            />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={10} tick={{ fontSize: 12, fill: "var(--color-text-tertiary)" }} />
            <Tooltip content={() => null} cursor={{ fill: "var(--color-chart-track)", opacity: 0.5 }} />
            <Bar dataKey="spent" fill="var(--color-accent-solid)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="saved" stackId="unspent" fill="var(--color-chart-5)" />
            <Bar dataKey="rest" stackId="unspent" fill="var(--color-chart-neutral)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
