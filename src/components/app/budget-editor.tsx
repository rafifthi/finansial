"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { RiArrowGoBackLine, RiArrowRightLine, RiArrowRightSLine, RiFileCopyLine, RiPriceTag3Line, RiSave3Line } from "@remixicon/react";
import { copyPreviousMonth, saveBudgets } from "@/actions/budget";
import { Chip } from "@/components/base/badges/chip";
import { Button, ButtonLink } from "@/components/base/buttons/button";
import { Meter } from "@/components/base/meter/meter";
import { AlertDialog } from "@/components/base/modal/modal";
import { toast } from "@/components/base/toast/toast";
import {
  formatMoney,
  formatPercent,
  type MoneyFormat,
} from "@/lib/finance/money";
import { cx } from "@/utils/cx";
import type { Account } from "@/lib/sheets/schema";
import { AccountLogo } from "./account-logo";
import { usageTone } from "./budget-bar";
import { CategoryIcon } from "./category-icon";
import { MoneyField } from "./fields";
import { undoToast } from "./undo";
import { useBookHref, useBookId, useCan } from "./permissions";

export interface EditorLine {
  categoryId: string;
  name: string;
  group: "Needs" | "Wants" | "Savings" | "Income";
  emoji: string;
  color: string;
  budget: number;
  actual: number;
  /** Account the category's money is kept in (its own default, else the group's pocket). */
  accountId: string;
}

export interface PocketAccount {
  id: string;
  name: string;
  type: Account["type"];
  institution: string;
  balance: number;
}

type Group = EditorLine["group"];

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
  accounts,
}: {
  month: string;
  lines: EditorLine[];
  money: MoneyFormat;
  accounts: PocketAccount[];
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

  /** What a save would change, in sheet order. */
  const changes = lines
    .filter((l) => (values[l.categoryId] ?? 0) !== l.budget)
    .map((l) => ({ id: l.categoryId, name: l.name, from: l.budget, to: values[l.categoryId] ?? 0 }));

  const [confirmSave, setConfirmSave] = useState(false);
  const askSave = () => {
    if (dirty && !pending) setConfirmSave(true);
  };
  // Enter commits the field's value in the same keystroke, so the check reads it after that render lands.
  const dirtyRef = useRef(dirty);
  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);
  // Resolves when saved (closing the dialog); rejects on failure so it stays open.
  const save = async () => {
    const res = await saveBudgets(bookId, {
      month,
      items: lines.map((l) => ({
        category_id: l.categoryId,
        amount: values[l.categoryId] ?? 0,
      })),
    });
    if (!res.ok) {
      toast("Couldn't save budget", { status: "error", description: res.error });
      throw new Error(res.error);
    }
    toast("Budget saved", { status: "success" });
  };

  /** Back to the saved figures; Undo brings the typed ones back. */
  const revert = () => {
    const typed = values;
    setValues(Object.fromEntries(lines.map((l) => [l.categoryId, l.budget])));
    undoToast(`Reverted ${changes.length} ${changes.length === 1 ? "change" : "changes"}`, async () => {
      setValues(typed);
      return { ok: true };
    });
  };

  const accountName = (id: string) => accounts.find((a) => a.id === id)?.name;

  // Unsaved figures survive neither a reload nor closing the tab without a warning.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const [confirmCopy, setConfirmCopy] = useState(false);
  const askCopy = () => (dirty ? setConfirmCopy(true) : copy());
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
    <div
      className="flex flex-col gap-4"
      // Enter in any amount asks to save, like a form. Capture phase: React Aria's
      // number field stops Enter from bubbling once it commits the value.
      onKeyDownCapture={(e) => {
        if (e.key === "Enter" && e.target instanceof HTMLInputElement && !pending) {
          setTimeout(() => {
            if (dirtyRef.current) setConfirmSave(true);
          }, 0);
        }
      }}
    >
      <AlertDialog
        isOpen={confirmSave}
        onOpenChange={setConfirmSave}
        variant="default"
        icon={RiSave3Line}
        title={`Save ${changes.length} budget ${changes.length === 1 ? "change" : "changes"}?`}
        description={`This updates the ${periodName(month)} budget in your sheet for everyone in the book.`}
        confirmLabel="Save budget"
        pendingLabel="Saving…"
        onConfirm={save}
      >
        <ul className="flex max-h-64 flex-col divide-y divide-separator-border overflow-y-auto rounded-xl border border-border-button-default">
          {changes.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3 px-3 py-2">
              <span className="truncate text-body-medium text-text-primary">{c.name}</span>
              <span className="flex shrink-0 items-center gap-1.5 text-body-2-regular tabular-nums">
                <span className="text-text-tertiary line-through">{fmt(c.from)}</span>
                <RiArrowRightLine className="size-3.5 text-foreground-icon-tertiary" aria-label="to" />
                <span className="text-body-2-medium text-text-primary">{fmt(c.to)}</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 flex justify-between text-body-2-regular text-text-secondary">
          <span>Left to assign after saving</span>
          <span className={cx("tabular-nums text-body-2-medium", summary.rest < 0 ? "text-text-error-primary" : "text-text-primary")}>{fmt(summary.rest)}</span>
        </p>
      </AlertDialog>
      <AlertDialog
        isOpen={confirmCopy}
        onOpenChange={setConfirmCopy}
        title="Replace your unsaved changes?"
        description="Copying last month's budget overwrites the amounts you've typed here and haven't saved."
        confirmLabel="Copy last month"
        variant="default"
        onConfirm={() => {
          setConfirmCopy(false);
          copy();
        }}
      />
      <div className="grid grid-cols-2 items-center gap-x-6 gap-y-3 rounded-3xl border border-separator-border bg-background-primary-default p-4 sm:flex sm:flex-wrap lg:sticky lg:top-3 lg:z-10 lg:shadow-sidebar">
        <Figure label="Planned income" value={fmt(summary.income)} />
        <Figure label="Allocated" value={fmt(summary.allocated)} />
        <Figure
          label="Left to assign"
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
            <ButtonLink href={bookHref("/settings?tab=categories#categories")} variant="ghost" leadingIcon={RiPriceTag3Line}>
              Manage categories
            </ButtonLink>
          ) : null}
          {canWrite ? (
            <>
              <Button variant="secondary" leadingIcon={RiFileCopyLine} onClick={askCopy} disabled={pending}>
                Copy last month
              </Button>
              {dirty ? (
                <Button variant="secondary" leadingIcon={RiArrowGoBackLine} onClick={revert} disabled={pending} className="hidden lg:inline-flex">
                  Revert
                </Button>
              ) : null}
              <Button variant="primary" leadingIcon={RiSave3Line} onClick={askSave} disabled={pending || !dirty} className="hidden lg:inline-flex">
                {dirty ? `Save ${changes.length} ${changes.length === 1 ? "change" : "changes"}` : "Save"}
              </Button>
            </>
          ) : null}
        </div>
      </div>

      <PocketPlan
        lines={lines}
        values={values}
        accounts={accounts}
        money={money}
        settingsHref={canEditCategories ? bookHref("/settings?tab=categories#categories") : undefined}
      />

      {/* Below lg: a save bar floats above the tab bar once something changed */}
      {canWrite && dirty ? (
        <div className="fixed inset-x-3 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-30 flex items-center justify-between gap-3 rounded-2xl border border-border-button-default bg-background-primary-default p-2 ps-4 shadow-sidebar lg:hidden">
          <span className="text-body-2-medium text-text-secondary">
            {changes.length} unsaved {changes.length === 1 ? "change" : "changes"}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" leadingIcon={RiArrowGoBackLine} onClick={revert} disabled={pending} className="max-sm:h-11">
              Revert
            </Button>
            <Button variant="primary" leadingIcon={RiSave3Line} onClick={askSave} disabled={pending} className="max-sm:h-11">
              Save
            </Button>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        {SECTIONS.map((section) => {
          const items = lines.filter((l) => l.group === section.group);
          const settingsHref = bookHref(`/settings?tab=categories&group=${section.group}#categories`);
          const total = items.reduce(
            (s, l) => s + (values[l.categoryId] ?? 0),
            0,
          );
          const actual = items.reduce((s, l) => s + l.actual, 0);
          return (
            <section
              key={section.group}
              className="flex flex-col gap-3 rounded-3xl border border-separator-border bg-background-primary-default p-4 sm:p-5"
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
                      <div className="flex min-w-0 items-center gap-3">
                        <CategoryIcon name={l.name} emoji={l.emoji} color={l.color} group={l.group} />
                        <div className="flex min-w-0 flex-1 flex-col gap-1">
                          <div className="flex min-w-0 flex-col">
                            <span className="truncate text-body-medium text-text-primary">
                              {l.name}
                            </span>
                            <span className="flex min-w-0 justify-between gap-2 text-caption-1-medium text-text-tertiary">
                              <span className="truncate">{l.accountId ? accountName(l.accountId) : null}</span>
                              <span className="shrink-0 tabular-nums">{fmt(l.actual)}</span>
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
                      </div>
                      {canWrite ? (
                        <MoneyField
                          value={budget}
                          onChange={(v) =>
                            setValues((s) => ({ ...s, [l.categoryId]: v ?? 0 }))
                          }
                          money={money}
                          aria-label={`${l.name} budget`}
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

/**
 * Per account: what this month's plan keeps there, what's still to be spent
 * from it, and whether its balance covers that. Read as the payday transfer list.
 */
function PocketPlan({
  lines,
  values,
  accounts,
  money,
  settingsHref,
}: {
  lines: EditorLine[];
  values: Record<string, number>;
  accounts: PocketAccount[];
  money: MoneyFormat;
  /** Where admins set each category's account. */
  settingsHref?: string;
}) {
  const fmt = (n: number) => formatMoney(n, money);
  const rows = new Map<string, { planned: number; remaining: number; groups: Set<Group> }>();
  for (const l of lines) {
    if (l.group === "Income") continue;
    const planned = values[l.categoryId] ?? 0;
    if (!planned) continue;
    const row = rows.get(l.accountId) ?? { planned: 0, remaining: 0, groups: new Set<Group>() };
    row.planned += planned;
    // What hasn't been spent (or, for savings, set aside) yet still has to be there.
    row.remaining += Math.max(planned - l.actual, 0);
    row.groups.add(l.group);
    rows.set(l.accountId, row);
  }
  if (rows.size === 0) return null;
  const ordered = [...rows.entries()].sort(([a], [b]) => (a ? (b ? 0 : -1) : 1));

  return (
    <section className="flex flex-col gap-3 rounded-3xl border border-separator-border bg-background-primary-default p-4 sm:p-5">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-headline-semibold text-text-primary">Pockets</h2>
        <p className="text-body-2-regular text-text-tertiary">
          Where this month&apos;s budget is kept, from each category&apos;s account. Move these amounts on payday.
        </p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {ordered.map(([id, row]) => {
          const account = accounts.find((a) => a.id === id);
          const short = account ? row.remaining - account.balance : 0;
          return (
            <li key={id || "none"} className="flex flex-col gap-1 rounded-2xl bg-background-secondary-default p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-2">
                  {account ? <AccountLogo account={account} size="sm" /> : null}
                  <span className={cx("truncate text-body-medium", account ? "text-text-primary" : "text-text-tertiary")}>
                    {account?.name ?? "No account set"}
                  </span>
                </span>
                <span className="shrink-0 text-body-semibold text-text-primary tabular-nums">{fmt(row.planned)}</span>
              </div>
              <span className="text-body-2-regular text-text-tertiary">{[...row.groups].join(" · ")}</span>
              {account ? (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-body-2-regular text-text-secondary tabular-nums">Balance {fmt(account.balance)}</span>
                  {short > 0 ? (
                    <Chip color="rose" variant="caption">
                      Short {fmt(short)}
                    </Chip>
                  ) : (
                    <Chip color="lime" variant="caption">
                      Covered
                    </Chip>
                  )}
                </div>
              ) : (
                <span className="text-body-2-regular text-text-secondary">
                  {settingsHref ? (
                    <Link href={settingsHref} className="text-button-ghost-foreground hover:underline">
                      Set these categories&apos; accounts
                    </Link>
                  ) : (
                    "Ask an admin to set these categories' accounts."
                  )}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
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

/** "2026-11" → "November 2026". */
function periodName(month: string) {
  const [y, m] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" }).format(new Date(Date.UTC(y, m - 1, 1)));
}
