"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { RiArrowGoBackLine, RiArrowRightLine, RiArrowRightSLine, RiFileCopyLine, RiPriceTag3Line, RiSave3Line, RiSafe2Line } from "@remixicon/react";
import { closeMonth, copyPreviousMonth, saveBudgets } from "@/actions/budget";
import { Chip } from "@/components/base/badges/chip";
import { Button, ButtonLink } from "@/components/base/buttons/button";
import { Checkbox } from "@/components/base/checkbox/checkbox";
import { Meter } from "@/components/base/meter/meter";
import { AlertDialog, Modal, ModalBody, ModalFooter, ModalHeader } from "@/components/base/modal/modal";
import { toast } from "@/components/base/toast/toast";
import {
  formatMoney,
  formatPercent,
  type MoneyFormat,
} from "@/lib/finance/money";
import { closeMonthPlan } from "@/lib/finance/budget";
import { cx } from "@/utils/cx";
import { usageTone } from "./budget-bar";
import { CategoryIcon } from "./category-icon";
import { MoneyField, SelectField } from "./fields";
import { undoToast } from "./undo";
import { useBookHref, useBookId, useCan } from "./permissions";

export interface EditorLine {
  categoryId: string;
  name: string;
  group: "Needs" | "Wants" | "Savings" | "Income";
  emoji: string;
  color: string;
  budget: number;
  /** Spending plus budget moved out, minus budget moved in; for Savings, net saved this month. */
  actual: number;
  /** Savings only: what the pot holds today. */
  balance?: number;
}

/** Whether the month can be closed: past and current periods only, with days left in the current one. */
export interface CloseState {
  open: boolean;
  /** Days left in the period; 0 on its last day or for a past period. */
  daysLeft: number;
  /** The 28th–31st of the month in the current period: time to close it. */
  remind: boolean;
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
    hint: "Set aside first — these fill your savings pots",
  },
  { group: "Needs", title: "Needs", hint: "Bills and essentials" },
  { group: "Wants", title: "Wants", hint: "Everything else" },
] as const;

export function BudgetEditor({
  month,
  lines,
  money,
  close,
}: {
  month: string;
  lines: EditorLine[];
  money: MoneyFormat;
  close: CloseState;
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
              {close.open ? <MonthClose month={month} lines={lines} money={money} daysLeft={close.daysLeft} remind={close.remind} dirty={dirty} /> : null}
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
                    {section.group === "Income" ? "received" : section.group === "Savings" ? "saved" : "used"}{" "}
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
                              <span className="truncate tabular-nums">{l.balance !== undefined ? `Pot ${fmt(l.balance)}` : null}</span>
                              <span className="shrink-0 tabular-nums">
                                {section.group === "Income" || section.group === "Savings" ? fmt(l.actual) : `${fmt(Math.max(budget - l.actual, 0))} left`}
                              </span>
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
 * Month-end close: what's left on Needs and Wants first covers the lines that
 * went over, and the rest moves to a savings pot, so every budget ends at zero.
 * A toolbar button opens it in a popup; from the 28th it's highlighted as a
 * reminder while there's still something to move. The preview uses the saved
 * budget; the server re-plans from the sheet on confirm.
 */
function MonthClose({
  month,
  lines,
  money,
  daysLeft,
  remind,
  dirty,
}: {
  month: string;
  lines: EditorLine[];
  money: MoneyFormat;
  daysLeft: number;
  remind: boolean;
  dirty: boolean;
}) {
  const bookId = useBookId();
  const fmt = (n: number) => formatMoney(n, money);
  const pots = lines.filter((l) => l.group === "Savings");
  const [saveTo, setSaveTo] = useState(() => [...pots].sort((a, b) => (b.balance ?? 0) - (a.balance ?? 0))[0]?.categoryId ?? "");
  const [skip, setSkip] = useState<Set<string>>(() => new Set());
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const spending = lines.filter((l) => l.group === "Needs" || l.group === "Wants");
  const asPlan = (list: EditorLine[]) => list.map((l) => ({ category: { id: l.categoryId, group: l.group }, remaining: l.budget - l.actual }));
  const leftovers = spending.filter((l) => l.budget - l.actual > 0);
  const over = spending.filter((l) => l.budget - l.actual < 0);
  const moves = closeMonthPlan(asPlan(spending.filter((l) => !skip.has(l.categoryId))), saveTo);
  const covered = moves.filter((m) => m.reason === "cover").reduce((s, m) => s + m.amount, 0);
  const saved = moves.filter((m) => m.reason === "save").reduce((s, m) => s + m.amount, 0);
  const stillOver = over.reduce((s, l) => s + (l.actual - l.budget), 0) - covered;
  const name = (id: string) => lines.find((l) => l.categoryId === id)?.name ?? "";
  const todo = leftovers.length > 0 || over.length > 0;
  const highlight = remind && todo;
  const left = leftovers.reduce((s, l) => s + (l.budget - l.actual), 0);

  const book = () =>
    startTransition(async () => {
      const res = await closeMonth(bookId, { month, save_to: saveTo, skip: [...skip] });
      if (!res.ok) return void toast("Couldn't close the month", { status: "error", description: res.error });
      toast(res.data?.saved ? `Moved ${fmt(res.data.saved)} to ${name(saveTo)}` : "Overspending covered", { status: "success" });
      setOpen(false);
    });

  return (
    <>
      <Button
        variant={highlight ? "primary" : "secondary"}
        leadingIcon={RiSafe2Line}
        onClick={() => setOpen(true)}
        aria-description={highlight ? `${fmt(left)} left in ${periodName(month)} to move` : undefined}
      >
        Close the month
      </Button>
      <Modal isOpen={open} onOpenChange={setOpen} size="lg" aria-label="Close the month">
        <ModalHeader
          icon={RiSafe2Line}
          title={`Close ${periodName(month)}`}
          description={
            todo
              ? `Leftovers on Needs and Wants first cover what went over budget. The rest goes to savings.${
                  daysLeft > 0 ? ` ${daysLeft} ${daysLeft === 1 ? "day" : "days"} left in this period, so it's best done on the last day.` : ""
                }`
              : "Every Needs and Wants budget is used up. Nothing to move."
          }
        />
        {todo ? (
          <ModalBody className="flex flex-col gap-3">
            {leftovers.length > 0 ? (
              <ul className="flex flex-col divide-y divide-separator-border rounded-2xl border border-border-button-default">
                {leftovers.map((l) => (
                  <li key={l.categoryId} className="flex items-center justify-between gap-3 px-3 py-2">
                    <Checkbox
                      isSelected={!skip.has(l.categoryId)}
                      onChange={(on) =>
                        setSkip((s) => {
                          const next = new Set(s);
                          if (on) next.delete(l.categoryId);
                          else next.add(l.categoryId);
                          return next;
                        })
                      }
                      className="min-h-11 min-w-0 sm:min-h-0"
                    >
                      <span className="truncate">{l.name}</span>
                    </Checkbox>
                    <span className="shrink-0 text-body-2-medium text-text-primary tabular-nums">{fmt(l.budget - l.actual)} left</span>
                  </li>
                ))}
              </ul>
            ) : null}

            {moves.length > 0 ? (
              <ul className="flex flex-col gap-1.5">
                {moves.map((m) => (
                  <li key={`${m.from}-${m.to}`} className="flex items-center justify-between gap-3 text-body-2-regular text-text-secondary">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span className="truncate">{name(m.from)}</span>
                      <RiArrowRightLine className="size-3.5 shrink-0 text-foreground-icon-tertiary rtl:rotate-180" aria-label="to" />
                      <span className="truncate text-text-primary">{name(m.to)}</span>
                      {m.reason === "cover" ? (
                        <Chip color="yellow" variant="caption">
                          Covers overspend
                        </Chip>
                      ) : null}
                    </span>
                    <span className="shrink-0 text-body-2-medium text-text-primary tabular-nums">{fmt(m.amount)}</span>
                  </li>
                ))}
              </ul>
            ) : null}

            {stillOver > 0 ? (
              <p className="text-body-2-medium text-text-error-primary">
                {fmt(stillOver)} is still over budget with no leftover to cover it. Move it from savings with a transfer if you need to.
              </p>
            ) : null}

            {pots.length > 0 ? (
              <SelectField
                label="Send leftovers to"
                value={saveTo}
                onChange={setSaveTo}
                options={pots.map((p) => ({ id: p.categoryId, label: p.name }))}
              />
            ) : (
              <p className="text-body-2-regular text-text-secondary">Add a Savings category to send leftovers to.</p>
            )}
            {dirty ? <p className="text-body-2-regular text-text-tertiary">Save your budget changes first.</p> : null}
            <p className="text-caption-1-regular text-text-tertiary">
              Booked as transfers dated {daysLeft > 0 ? "today" : "the last day of the period"}.
            </p>
          </ModalBody>
        ) : null}
        <ModalFooter>
          <Button variant="secondary" onClick={() => setOpen(false)} disabled={pending}>
            {todo ? "Cancel" : "Close"}
          </Button>
          {todo ? (
            <Button variant="primary" leadingIcon={RiSafe2Line} onClick={book} disabled={pending || dirty || moves.length === 0}>
              {pending ? "Booking…" : saved > 0 ? `Move ${fmt(saved)} to savings` : "Cover overspend"}
            </Button>
          ) : null}
        </ModalFooter>
      </Modal>
    </>
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
