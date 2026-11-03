import type { Metadata } from "next";
import { requireBookPage } from "@/auth";
import { Card, EmptyState } from "@/components/app/card";
import { EntityFormButton } from "@/components/app/entity-form";
import { monthLabel } from "@/components/app/month-nav";
import { PageHeader } from "@/components/app/page-header";
import { Chip } from "@/components/base/badges/chip";
import { Meter } from "@/components/base/meter/meter";
import { loadAppData } from "@/lib/data/app-data";
import { fieldSpecs } from "@/lib/data/field-specs";
import { monthOf } from "@/lib/finance/dates";
import { goalProgress } from "@/lib/finance/goals";
import { formatMoney } from "@/lib/finance/money";

export const metadata: Metadata = { title: "Goals" };

export default async function GoalsPage({ params }: PageProps<"/b/[bookId]/goals">) {
  const data = await loadAppData(await requireBookPage((await params).bookId));
  const specs = fieldSpecs(data);
  const fmt = (n: number) => formatMoney(n, data.money);
  const goals = data.goals.map((g) => goalProgress(g, data.categories, data.transactions, data.today, data.cutoffDay));
  const fundedBy = (goalId: string) => data.categories.filter((c) => c.goal_id === goalId).map((c) => c.name);

  return (
    <>
      <PageHeader
        title="Goals"
        description="A goal grows with every transaction in a category linked to it (Settings → Categories → Funds goal)."
        actions={<EntityFormButton table="goals" title="Goal" fields={specs.goals} money={data.money} initial={{ starting_amount: 0 }} />}
      />
      {goals.length === 0 ? (
        <Card>
          <EmptyState>No goals yet — try Travel, House or Dana Darurat.</EmptyState>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {goals.map((p) => {
            const sources = fundedBy(p.goal.id);
            const last = p.history.slice(-6);
            const max = Math.max(1, ...last.map((h) => h.amount));
            return (
              <Card
                key={p.goal.id}
                title={p.goal.name}
                description={p.goal.target_date ? `Target ${monthLabel(monthOf(p.goal.target_date))}` : "No deadline"}
                className={p.goal.archived ? "opacity-60" : undefined}
                action={<EntityFormButton table="goals" title="Goal" trigger="icon" fields={specs.goals} money={data.money} initial={p.goal} />}
              >
                <div className="flex items-end justify-between gap-3">
                  <div className="flex flex-col">
                    <span className="text-display-4-medium text-text-primary tabular-nums">{fmt(p.saved)}</span>
                    <span className="text-body-2-regular text-text-tertiary tabular-nums">of {fmt(p.goal.target_amount)}</span>
                  </div>
                  {p.ratio >= 1 ? (
                    <Chip color="lime">Reached 🎉</Chip>
                  ) : p.requiredMonthly !== null ? (
                    <Chip color={p.monthsLeft === 0 ? "rose" : "neutral"}>
                      {fmt(p.requiredMonthly)}/mo · {p.monthsLeft} mo left
                    </Chip>
                  ) : (
                    <Chip color="neutral">{fmt(p.remaining)} to go</Chip>
                  )}
                </div>
                <Meter aria-label={`${p.goal.name} progress`} value={p.ratio * 100} tone={p.ratio >= 1 ? "success" : "accent"} />
                {last.length ? (
                  <div className="flex h-16 items-end gap-1.5" aria-label="Contributions, last 6 months">
                    {last.map((h) => (
                      <div key={h.month} className="flex flex-1 flex-col items-center gap-1" title={`${monthLabel(h.month)}: ${fmt(h.amount)}`}>
                        <div className="w-full rounded-t-md bg-chart-5" style={{ height: `${Math.max(6, (h.amount / max) * 44)}px` }} />
                        <span className="text-caption-2-medium text-text-tertiary">{monthLabel(h.month, "en-GB", "short").split(" ")[0]}</span>
                      </div>
                    ))}
                  </div>
                ) : null}
                <p className="text-body-2-regular text-text-tertiary">
                  {sources.length ? `Funded by: ${sources.join(", ")}` : "Not linked to a category yet."}
                </p>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
