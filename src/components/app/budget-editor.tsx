"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { RiArrowRightSLine, RiFileCopyLine, RiPriceTag3Line, RiSave3Line } from "@remixicon/react";
import { copyPreviousMonth, saveBudgets } from "@/actions/budget";
import { Chip } from "@/components/base/badges/chip";
import { Button, ButtonLink } from "@/components/base/buttons/button";
import { Meter } from "@/components/base/meter/meter";
import { toast } from "@/components/base/toast/toast";
import {
  formatMoney,
  formatPercent,
  type MoneyFormat,
} from "@/lib/finance/money";
import { cx } from "@/utils/cx";
import { usageTone } from "./budget-bar";
import { MoneyField } from "./fields";
import { useBookHref, useBookId, useCan } from "./permissions";

export interface EditorLine {
  categoryId: string;
  name: string;
  group: "Needs" | "Wants" | "Savings" | "Income";
  budget: number;
  actual: number;
}

const SECTIONS = [
  {
    group: "Income",
    title: "Planned income",
    hint: "What you expect to receive this month",
  },
  {
    group: "Savings",
    title: "Savings",
    hint: "Set aside first — these feed your goals",
  },
  { group: "Needs", title: "Needs", hint: "Bills and essentials" },
  { group: "Wants", title: "Wants", hint: "Everything else" },
] as const;

export function BudgetEditor({
  month,
  lines,
  money,
}: {
  month: string;
  lines: EditorLine[];
  money: MoneyFormat;
}) {
  const [values, setValues] = useState<Record<string, number>>(() =>
    Object.fromEntries(lines.map((l) => [l.categoryId, l.budget])),
  );
  const [pending, startTransition] = useTransition();
  const canWrite = useCan("data:write");
  const bookId = useBookId();
  const bookHref = useBookHref();
  const canEditCategories = useCan("setup:write");
  const fmt = (n: number) => formatMoney(n, money);
  const dirty = lines.some((l) => (values[l.categoryId] ?? 0) !== l.budget);

  const summary = useMemo(() => {
    let income = 0;
    let allocated = 0;
    for (const l of lines) {
      const v = values[l.categoryId] ?? 0;
      if (l.group === "Income") income += v;
      else allocated += v;
    }
    return {
      income,
      allocated,
      rest: income - allocated,
      ratio: income > 0 ? allocated / income : 0,
    };
  }, [lines, values]);

  const save = () =>
    startTransition(async () => {
      const res = await saveBudgets(bookId, {
        month,
        items: lines.map((l) => ({
          category_id: l.categoryId,
          amount: values[l.categoryId] ?? 0,
        })),
      });
      if (res.ok) toast("Budget saved", { status: "success" });
      else
        toast("Couldn't save budget", {
          status: "error",
          description: res.error,
        });
    });

  const copy = () =>
    startTransition(async () => {
      const res = await copyPreviousMonth(bookId, { month });
      // On success the page re-renders and re-keys the editor with the copied figures.
      if (res.ok) toast("Copied last month's budget", { status: "success" });
      else
        toast("Nothing copied", {
          status: "information",
          description: res.error,
        });
    });

  return (
    <div className="flex flex-col gap-4">
      <div className="glass grid grid-cols-2 items-center gap-x-6 gap-y-3 rounded-3xl border border-border-button-default bg-background-primary-default p-4 sm:flex sm:flex-wrap lg:sticky lg:top-3 lg:z-10 lg:shadow-sidebar">
        <Figure label="Planned income" value={fmt(summary.income)} />
        <Figure label="Allocated" value={fmt(summary.allocated)} />
        <Figure
          label="Non-allocated"
          value={fmt(summary.rest)}
          className={summary.rest < 0 ? "text-text-error-primary" : undefined}
        />
        <Chip
          color={
            summary.rest < 0
              ? "rose"
              : summary.ratio >= 0.999
                ? "lime"
                : "neutral"
          }
        >
          {formatPercent(summary.ratio, money.locale)} allocated
        </Chip>
        <div className="col-span-2 flex flex-wrap gap-2 sm:ms-auto">
          {canEditCategories ? (
            <ButtonLink href={bookHref("/settings#categories")} variant="ghost" leadingIcon={RiPriceTag3Line}>
              Manage categories
            </ButtonLink>
          ) : null}
          {canWrite ? (
            <>
              <Button variant="secondary" leadingIcon={RiFileCopyLine} onClick={copy} disabled={pending}>
                Copy last month
              </Button>
              <Button variant="primary" leadingIcon={RiSave3Line} onClick={save} disabled={pending || !dirty} className="hidden lg:inline-flex">
                {pending ? "Saving…" : "Save"}
              </Button>
            </>
          ) : null}
        </div>
      </div>

      {/* Below lg: a save bar floats above the tab bar once something changed */}
      {canWrite && dirty ? (
        <div className="fixed inset-x-3 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-30 flex items-center justify-between gap-3 rounded-2xl border border-border-button-default bg-background-primary-default p-2 ps-4 shadow-sidebar lg:hidden">
          <span className="text-body-2-medium text-text-secondary">Unsaved changes</span>
          <Button variant="primary" leadingIcon={RiSave3Line} onClick={save} disabled={pending}>
            {pending ? "Saving…" : "Save budget"}
          </Button>
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        {SECTIONS.map((section) => {
          const items = lines.filter((l) => l.group === section.group);
          const settingsHref = bookHref(`/settings?group=${section.group}#categories`);
          const total = items.reduce(
            (s, l) => s + (values[l.categoryId] ?? 0),
            0,
          );
          const actual = items.reduce((s, l) => s + l.actual, 0);
          return (
            <section
              key={section.group}
              className="glass flex flex-col gap-3 rounded-3xl border border-border-button-default bg-background-primary-default p-4 sm:p-5"
            >
              <header className="flex items-start justify-between gap-3">
                <div className="flex flex-col gap-0.5">
                  <h2 className="text-headline-semibold text-text-primary">
                    {section.title}
                  </h2>
                  <p className="text-body-2-regular text-text-tertiary">
                    {section.hint}
                  </p>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-body-semibold text-text-primary tabular-nums">
                    {fmt(total)}
                  </span>
                  <span className="text-body-2-regular text-text-tertiary tabular-nums">
                    {section.group === "Income" ? "received" : "used"}{" "}
                    {fmt(actual)}
                  </span>
                </div>
              </header>
              {items.length === 0 ? (
                <p className="rounded-2xl bg-background-secondary-default p-3 text-body-2-regular text-text-secondary">
                  No {section.title.toLowerCase()} categories yet.
                </p>
              ) : null}
              <ul className="flex flex-col divide-y divide-separator-border">
                {items.map((l) => {
                  const budget = values[l.categoryId] ?? 0;
                  const usage =
                    budget > 0 ? l.actual / budget : l.actual > 0 ? 2 : 0;
                  return (
                    <li
                      key={l.categoryId}
                      className="flex flex-col gap-2 py-3 sm:grid sm:grid-cols-[minmax(0,1fr)_minmax(0,11rem)] sm:items-center sm:gap-3 sm:py-2.5"
                    >
                      <div className="flex min-w-0 flex-col gap-1.5">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-body-medium text-text-primary">
                            {l.name}
                          </span>
                          <span className="shrink-0 text-body-2-regular text-text-tertiary tabular-nums">
                            {fmt(l.actual)}
                          </span>
                        </div>
                        {section.group !== "Income" ? (
                          <Meter
                            aria-label={`${l.name} usage`}
                            value={Math.min(usage, 1) * 100}
                            tone={usageTone(usage, section.group === "Savings")}
                            size="sm"
                          />
                        ) : null}
                      </div>
                      {canWrite ? (
                        <MoneyField
                          value={budget}
                          onChange={(v) =>
                            setValues((s) => ({ ...s, [l.categoryId]: v ?? 0 }))
                          }
                          money={money}
                          label={undefined}
                          className="w-full"
                        />
                      ) : (
                        <span className="text-end text-body-medium text-text-primary tabular-nums">
                          {fmt(budget)}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
              {canEditCategories ? (
                <Link
                  href={settingsHref}
                  className="flex items-center justify-between gap-2 rounded-xl border border-dashed border-border-button-default px-3 py-2.5 text-body-2-medium text-text-secondary outline-none hover:bg-background-secondary-hover focus-visible:ring-2 focus-visible:ring-border-focus-ring"
                >
                  <span className="flex items-center gap-2">
                    <RiPriceTag3Line className="size-4 text-foreground-icon-tertiary" aria-hidden />
                    {section.group === "Income" ? "Add or edit income sources" : `Add or edit ${section.title} categories`}
                  </span>
                  <RiArrowRightSLine className="size-4 text-foreground-icon-tertiary rtl:-scale-x-100" aria-hidden />
                </Link>
              ) : items.length === 0 ? (
                <p className="text-body-2-regular text-text-tertiary">Ask an admin to add categories in Settings.</p>
              ) : null}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function Figure({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className="flex flex-col">
      <span className="text-body-2-medium text-text-tertiary">{label}</span>
      <span
        className={cx(
          "text-title-3-semibold text-text-primary tabular-nums",
          className,
        )}
      >
        {value}
      </span>
    </div>
  );
}
