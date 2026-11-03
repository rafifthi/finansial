import type { Metadata } from "next";
import { requireBookPage } from "@/auth";
import { Card, EmptyState } from "@/components/app/card";
import { EntityFormButton } from "@/components/app/entity-form";
import { PageHeader } from "@/components/app/page-header";
import { RunRecurringButton } from "@/components/app/run-recurring";
import { Chip } from "@/components/base/badges/chip";
import { loadAppData } from "@/lib/data/app-data";
import { fieldSpecs } from "@/lib/data/field-specs";
import { addDays, addMonths, monthOf } from "@/lib/finance/dates";
import { formatMoney } from "@/lib/finance/money";
import { occurrences } from "@/lib/finance/recurring";

export const metadata: Metadata = { title: "Recurring" };

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default async function RecurringPage({ params }: PageProps<"/b/[bookId]/recurring">) {
  const data = await loadAppData(await requireBookPage((await params).bookId));
  const specs = fieldSpecs(data);
  const fmt = (n: number) => formatMoney(n, data.money);
  const horizon = addMonths(monthOf(data.today), 2) + "-01";

  return (
    <>
      <PageHeader
        title="Recurring"
        description="Bills and transfers that repeat. Due entries are booked automatically every morning (or now, with the button)."
        actions={
          <>
            <RunRecurringButton />
            <EntityFormButton
              table="recurring"
              title="Recurring entry"
              label="New rule"
              fields={specs.recurring}
              money={data.money}
              initial={{ type: "expense", frequency: "monthly", day: 1, start_date: data.today }}
            />
          </>
        }
      />
      <Card>
        {data.recurring.length === 0 ? (
          <EmptyState>No rules yet. Good candidates: Wifi, IPL, Kuota, Infaq, Cicilan Mobil.</EmptyState>
        ) : (
          <ul className="flex flex-col divide-y divide-separator-border">
            {data.recurring.map((r) => {
              const next = occurrences(r, addDays(data.today, 1), horizon)[0];
              const cat = data.categoryById.get(r.category_id);
              const ended = r.end_date && r.end_date < data.today;
              return (
                <li key={r.id} className="flex items-center gap-3 py-3">
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-body-medium text-text-primary">{r.description || cat?.name || "Untitled"}</span>
                      {cat ? <Chip variant="caption" color="neutral">{cat.name}</Chip> : null}
                    </div>
                    <span className="text-body-2-regular text-text-tertiary">
                      {r.frequency === "monthly" ? `Monthly on day ${r.day}` : `Weekly on ${WEEKDAYS[r.day] ?? r.day}`}
                      {data.accountById.get(r.account_id) ? ` · ${data.accountById.get(r.account_id)?.name}` : ""}
                      {ended ? " · ended" : next ? ` · next ${next}` : ""}
                    </span>
                  </div>
                  <span className="text-body-semibold text-text-primary tabular-nums">{fmt(r.amount)}</span>
                  <EntityFormButton table="recurring" title="Recurring entry" trigger="icon" fields={specs.recurring} money={data.money} initial={r} />
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}
