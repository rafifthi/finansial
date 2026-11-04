"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  RiAddLine,
  RiCheckDoubleLine,
  RiDeleteBinLine,
  RiFilter3Line,
  RiInboxLine,
} from "@remixicon/react";
import {
  deleteTransactions,
  setVerified,
} from "@/actions/transactions";
import { Button } from "@/components/base/buttons/button";
import { Chip, type ChipColor } from "@/components/base/badges/chip";
import { StatusDot } from "@/components/base/badges/status-dot";
import { Checkbox } from "@/components/base/checkbox/checkbox";
import { Drawer, DrawerBody, DrawerFooter, DrawerHeader } from "@/components/base/drawer/drawer";
import { SearchField } from "@/components/base/search-field/search-field";
import { toast } from "@/components/base/toast/toast";
import type { FormOptions } from "@/lib/data/app-data";
import { formatMoney } from "@/lib/finance/money";
import type { Transaction } from "@/lib/sheets/schema";
import { cx } from "@/utils/cx";
import { SelectField } from "./fields";
import { isOutsideDrawer } from "./form-drawer";
import { useBookId, useCan } from "./permissions";
import { fromTransaction, TransactionDrawer } from "./transaction-form";

export interface TxnRow {
  txn: Transaction;
  categoryName: string;
  group: string;
  accountName: string;
  toAccountName: string;
}

export const GROUP_CHIP: Record<string, ChipColor> = {
  Needs: "blue",
  Wants: "orange",
  Savings: "purple",
  Income: "lime",
};

function dayLabel(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(Date.UTC(y, m - 1, d));
}

export function TransactionsView({
  rows,
  options,
  filters,
  compact = false,
}: {
  rows: TxnRow[];
  options: FormOptions;
  filters?: Record<string, string>;
  /** Reconcile mode: no filter bar, verify-first actions. */
  compact?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<TxnRow["txn"] | null>(null);
  const [creating, setCreating] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const canWrite = useCan("data:write");
  const bookId = useBookId();
  const money = (n: number) => formatMoney(n, options.money);

  const setFilter = (key: string, value: string) => {
    const q = new URLSearchParams(search);
    if (value) q.set(key, value);
    else q.delete(key);
    router.replace(`${pathname}?${q}`, { scroll: false });
  };

  const byDay = useMemo(() => {
    const map = new Map<string, TxnRow[]>();
    for (const r of rows)
      map.set(r.txn.date, [...(map.get(r.txn.date) ?? []), r]);
    return [...map.entries()];
  }, [rows]);

  const totals = useMemo(() => {
    let income = 0;
    let out = 0;
    for (const { txn, group } of rows) {
      if (txn.type === "income") income += txn.amount;
      else if (txn.type === "expense" || group === "Savings") out += txn.amount;
    }
    return {
      income,
      out,
      unverified: rows.filter((r) => !r.txn.verified).length,
    };
  }, [rows]);

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const bulk = (
    fn: () => Promise<{ ok: boolean; error?: string }>,
    done: string,
  ) =>
    startTransition(async () => {
      const res = await fn();
      if (!res.ok)
        return void toast("Couldn't save", {
          status: "error",
          description: res.error,
        });
      toast(done, { status: "success" });
      setSelected(new Set());
    });

  const ids = [...selected];

  const FILTER_KEYS = ["type", "category", "account", "member", "verified"] as const;
  const activeFilters = filters ? FILTER_KEYS.filter((k) => filters[k]).length : 0;
  const clearFilters = () => {
    const q = new URLSearchParams(search);
    for (const k of FILTER_KEYS) q.delete(k);
    router.replace(`${pathname}?${q}`, { scroll: false });
  };
  const filterFields = filters ? (
    <>
      <SelectField
        className="sm:w-36"
        label={<span className="sm:sr-only">Type</span>}
        value={filters.type}
        onChange={(v) => setFilter("type", v)}
        allowEmpty="All types"
        options={[
          { id: "expense", label: "Expense" },
          { id: "income", label: "Income" },
          { id: "transfer", label: "Transfer" },
        ]}
      />
      <SelectField
        className="sm:w-48"
        label={<span className="sm:sr-only">Category</span>}
        value={filters.category}
        onChange={(v) => setFilter("category", v)}
        allowEmpty="All categories"
        options={options.categories.map((c) => ({ id: c.id, label: c.name }))}
        searchable
      />
      <SelectField
        className="sm:w-40"
        label={<span className="sm:sr-only">Account</span>}
        value={filters.account}
        onChange={(v) => setFilter("account", v)}
        allowEmpty="All accounts"
        options={options.accounts.map((a) => ({ id: a.id, label: a.name }))}
      />
      {options.members.length ? (
        <SelectField
          className="sm:w-36"
          label={<span className="sm:sr-only">Member</span>}
          value={filters.member}
          onChange={(v) => setFilter("member", v)}
          allowEmpty="Everyone"
          options={options.members.map((m) => ({ id: m, label: m }))}
        />
      ) : null}
      <SelectField
        className="sm:w-40"
        label={<span className="sm:sr-only">Status</span>}
        value={filters.verified}
        onChange={(v) => setFilter("verified", v)}
        allowEmpty="Any status"
        options={[
          { id: "false", label: "Unverified" },
          { id: "true", label: "Verified" },
        ]}
      />
    </>
  ) : null;

  return (
    <section className="flex flex-col gap-4">
      {!compact && filters ? (
        <div className="flex flex-wrap items-end gap-2">
          <SearchField
            aria-label="Search"
            placeholder="Search description or category"
            defaultValue={filters.q}
            onSubmit={(v) => setFilter("q", v)}
            onClear={() => setFilter("q", "")}
            className="min-w-0 flex-1 sm:w-64 sm:flex-none"
          />
          {/* Phones: filters live in a sheet behind one button */}
          <Button
            variant="secondary"
            leadingIcon={RiFilter3Line}
            onClick={() => setFiltersOpen(true)}
            className="sm:hidden"
            aria-label={activeFilters ? `Filters, ${activeFilters} active` : "Filters"}
          >
            {activeFilters ? `Filters · ${activeFilters}` : "Filters"}
          </Button>
          <div className="hidden sm:contents">{filterFields}</div>
          {canWrite ? (
            // Below lg the tab bar's "+" adds transactions
            <Button variant="primary" leadingIcon={RiAddLine} onClick={() => setCreating(true)} className="ms-auto hidden lg:inline-flex">
              Add
            </Button>
          ) : null}
          <Drawer isOpen={filtersOpen} onOpenChange={setFiltersOpen} shouldCloseOnInteractOutside={isOutsideDrawer} placement="bottom" aria-label="Filters" overlayClassName="p-0 pt-10" className="glass glass-full rounded-b-none pb-[max(1.5rem,env(safe-area-inset-bottom))]">
            <DrawerHeader title="Filters" description="Changes apply right away." />
            <DrawerBody className="flex flex-col gap-3">{filterFields}</DrawerBody>
            <DrawerFooter>
              <Button variant="primary" onClick={() => setFiltersOpen(false)}>
                Show {rows.length} transactions
              </Button>
              {activeFilters ? (
                <Button variant="secondary" onClick={clearFilters}>
                  Clear filters
                </Button>
              ) : null}
            </DrawerFooter>
          </Drawer>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 text-body-2-medium text-text-secondary">
        <Chip color="lime">In {money(totals.income)}</Chip>
        <Chip color="rose">Out {money(totals.out)}</Chip>
        <Chip color="neutral">{rows.length} transactions</Chip>
        {totals.unverified ? (
          <Chip color="yellow">{totals.unverified} unverified</Chip>
        ) : null}
      </div>

      {selected.size > 0 ? (
        // Floats over the list (never in the flow, so rows don't jump): above the
        // phone tab bar, and centred over the content column on desktop.
        <div
          role="toolbar"
          aria-label="Bulk actions"
          className={cx(
            "glass fixed inset-x-3 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-30 flex flex-wrap items-center gap-2 rounded-2xl border border-border-button-default p-2 shadow-sidebar",
            "float-in",
            "lg:inset-x-auto lg:bottom-6 lg:left-[calc(50%+136px)] lg:w-max lg:max-w-[calc(100vw-320px)] lg:-translate-x-1/2",
          )}
        >
          <span className="px-2 text-body-medium text-text-primary">
            {selected.size} selected
          </span>
          <Button
            size="small"
            variant="primary"
            leadingIcon={RiCheckDoubleLine}
            disabled={pending}
            onClick={() =>
              bulk(
                () => setVerified(bookId, { ids, verified: true }),
                "Marked as verified",
              )
            }
          >
            Mark verified
          </Button>
          <Button
            size="small"
            variant="secondary"
            disabled={pending}
            onClick={() =>
              bulk(
                () => setVerified(bookId, { ids, verified: false }),
                "Marked as unverified",
              )
            }
          >
            Unverify
          </Button>
          {!compact ? (
            <Button
              size="small"
              variant="danger"
              leadingIcon={RiDeleteBinLine}
              disabled={pending}
              onClick={() => bulk(() => deleteTransactions(bookId, { ids }), "Deleted")}
            >
              Delete
            </Button>
          ) : null}
          <Button
            size="small"
            variant="ghost"
            onClick={() => setSelected(new Set())}
            className="ms-auto"
          >
            Clear
          </Button>
        </div>
      ) : null}

      {selected.size > 0 ? <div aria-hidden className="order-last h-16" /> : null}

      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-3xl border border-dashed border-border-button-default py-16 text-center">
          <RiInboxLine
            className="size-6 text-foreground-icon-tertiary"
            aria-hidden
          />
          <p className="text-body-medium text-text-secondary">
            {compact ? "Everything is verified." : "No transactions match."}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {byDay.map(([day, items]) => {
            const allSelected = items.every((r) => selected.has(r.txn.id));
            return (
              <div
                key={day}
                className="glass overflow-hidden rounded-3xl border border-border-button-default bg-background-primary-default"
              >
                <div className="flex items-center gap-3 border-b border-separator-border bg-background-secondary-default px-4 py-2">
                  {canWrite ? (
                    <Checkbox
                      aria-label={`Select all on ${day}`}
                      isSelected={allSelected}
                      isIndeterminate={
                        !allSelected &&
                        items.some((r) => selected.has(r.txn.id))
                      }
                      onChange={(v) =>
                        setSelected((s) => {
                          const next = new Set(s);
                          for (const r of items) {
                            if (v) next.add(r.txn.id);
                            else next.delete(r.txn.id);
                          }
                          return next;
                        })
                      }
                    />
                  ) : null}
                  <span className="text-body-2-semibold text-text-secondary">
                    {dayLabel(day)}
                  </span>
                </div>
                <ul className="divide-y divide-separator-border">
                  {items.map((r) => (
                    <TxnListItem
                      key={r.txn.id}
                      row={r}
                      money={money}
                      selected={selected.has(r.txn.id)}
                      onToggle={canWrite ? () => toggle(r.txn.id) : undefined}
                      onOpen={canWrite ? () => setEditing(r.txn) : undefined}
                    />
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}

      <TransactionDrawer
        options={options}
        isOpen={creating}
        onOpenChange={setCreating}
      />
      <TransactionDrawer
        options={options}
        initial={editing ? fromTransaction(editing) : undefined}
        isOpen={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
      />
    </section>
  );
}

function TxnListItem({
  row,
  money,
  selected,
  onToggle,
  onOpen,
}: {
  row: TxnRow;
  money: (n: number) => string;
  selected: boolean;
  /** Omitted for read-only users. */
  onToggle?: () => void;
  onOpen?: () => void;
}) {
  const { txn } = row;
  const sign = txn.type === "income" ? "+" : txn.type === "expense" ? "−" : "";
  const subtitle =
    txn.type === "transfer"
      ? `${row.accountName || "?"} → ${row.toAccountName || "?"}`
      : [row.accountName, txn.member].filter(Boolean).join(" · ");
  return (
    <li
      className={cx(
        "flex items-center gap-3 px-4 py-3",
        selected && "bg-background-secondary-default",
      )}
    >
      {onToggle ? (
        <Checkbox
          aria-label="Select transaction"
          isSelected={selected}
          onChange={onToggle}
        />
      ) : null}
      <button
        type="button"
        onClick={onOpen}
        disabled={!onOpen}
        className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-lg text-start outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring disabled:cursor-default"
      >
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-body-medium text-text-primary">
              {txn.description ||
                row.categoryName ||
                (txn.type === "transfer" ? "Transfer" : "Untitled")}
            </span>
            {row.categoryName ? (
              <Chip
                variant="caption"
                color={GROUP_CHIP[row.group] ?? "neutral"}
              >
                {row.categoryName}
              </Chip>
            ) : null}
          </div>
          <span className="truncate text-body-2-regular text-text-tertiary">
            {subtitle}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span
            className={cx(
              "text-body-semibold tabular-nums",
              txn.type === "income"
                ? "text-status-lime-text"
                : "text-text-primary",
            )}
          >
            {sign}
            {money(txn.amount)}
          </span>
          <span
            title={txn.verified ? "Verified" : "Not verified yet"}
            className="flex"
          >
            <StatusDot
              color={txn.verified ? "green" : "yellow"}
              aria-label={txn.verified ? "Verified" : "Unverified"}
            />
          </span>
        </div>
      </button>
    </li>
  );
}
