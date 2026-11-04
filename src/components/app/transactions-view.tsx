"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import {
  RiAddLine,
  RiArrowLeftRightLine,
  RiCheckboxCircleFill,
  RiCheckboxMultipleLine,
  RiCloseCircleLine,
  RiCheckDoubleLine,
  RiDeleteBinLine,
  RiFilter3Line,
  RiInboxLine,
  RiPencilLine,
} from "@remixicon/react";
import {
  deleteTransactions,
  restoreTransactions,
  setVerified,
} from "@/actions/transactions";
import { Button } from "@/components/base/buttons/button";
import { Checkbox } from "@/components/base/checkbox/checkbox";
import { Drawer, DrawerBody, DrawerFooter, DrawerHeader } from "@/components/base/drawer/drawer";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { SearchField } from "@/components/base/search-field/search-field";
import { toast } from "@/components/base/toast/toast";
import type { FormOptions } from "@/lib/data/app-data";
import { formatMoney } from "@/lib/finance/money";
import type { Transaction } from "@/lib/sheets/schema";
import { cx } from "@/utils/cx";
import { CategoryIcon } from "./category-icon";
import { SelectField } from "./fields";
import { isOutsideDrawer } from "./form-drawer";
import { useBookId, useCan } from "./permissions";
import { fromTransaction, TransactionDrawer } from "./transaction-form";
import { undoToast } from "./undo";

export interface TxnRow {
  txn: Transaction;
  categoryName: string;
  group: string;
  categoryEmoji: string;
  categoryColor: string;
  accountName: string;
  toAccountName: string;
}

const utc = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};

/** "Today", "Yesterday", else "Mon 2 Nov". */
function dayLabel(iso: string, today: string) {
  const days = Math.round((utc(today) - utc(iso)) / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(utc(iso));
}

/** Money in and out over some rows; savings transfers count as out, like the budget. */
function flows(rows: TxnRow[]) {
  let income = 0;
  let out = 0;
  for (const { txn, group } of rows) {
    if (txn.type === "income") income += txn.amount;
    else if (txn.type === "expense" || group === "Savings") out += txn.amount;
  }
  return { income, out };
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
  // Bulk actions stay out of sight until a selection starts: "Select", the row context menu
  // (right-click / long-press → Select), or Cmd/Ctrl/Shift-click. While anything is
  // selected, every row shows its checkbox and a tap toggles instead of opening the editor.
  // Reconcile is all about selecting, so it starts there.
  const [selectMode, setSelectMode] = useState(false);
  const selecting = compact || selectMode || selected.size > 0;
  const stopSelecting = () => {
    setSelected(new Set());
    setSelectMode(false);
  };
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

  const totals = useMemo(() => flows(rows), [rows]);

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

  /** Deletes at once and offers Undo, for one row or a whole selection. */
  const removeRows = (targets: string[], title: string) =>
    startTransition(async () => {
      const res = await deleteTransactions(bookId, { ids: targets });
      if (!res.ok) return void toast("Couldn't delete", { status: "error", description: res.error });
      const removed = res.data ?? [];
      undoToast(title, () => restoreTransactions(bookId, { rows: removed }));
      setSelected(new Set());
    });

  const verifyOne = (id: string, verified: boolean) =>
    startTransition(async () => {
      const res = await setVerified(bookId, { ids: [id], verified });
      if (!res.ok) return void toast("Couldn't save", { status: "error", description: res.error });
      toast(verified ? "Marked as verified" : "Marked as unverified", { status: "success" });
    });

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

      <div className="flex items-center justify-between gap-3">
        <p className="text-body-regular text-text-secondary">
          {/* Income shows per day; unverified rows carry their own dot. */}
          {rows.length} {rows.length === 1 ? "transaction" : "transactions"} · out {money(totals.out)}
        </p>
        {canWrite && !compact && rows.length ? (
          <Button
            size="small"
            variant="ghost"
            onClick={() => (selecting ? stopSelecting() : setSelectMode(true))}
          >
            {selecting ? "Done" : "Select"}
          </Button>
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
              onClick={() => {
                const total = rows.filter((r) => selected.has(r.txn.id)).reduce((sum, r) => sum + r.txn.amount, 0);
                removeRows(ids, `Deleted ${ids.length} ${ids.length === 1 ? "transaction" : "transactions"} · ${money(total)}`);
              }}
            >
              Delete
            </Button>
          ) : null}
          <Button
            size="small"
            variant="ghost"
            onClick={stopSelecting}
            className="ms-auto"
          >
            Done
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
            const dayFlow = flows(items);
            return (
              <div key={day} className="flex flex-col gap-2">
                <div className="flex items-center gap-3 px-1">
                  {canWrite && selecting ? (
                    <Checkbox
                      aria-label={`Select all on ${day}`}
                      isSelected={allSelected}
                      isIndeterminate={!allSelected && items.some((r) => selected.has(r.txn.id))}
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
                  <h2 className="text-body-medium text-text-secondary">{dayLabel(day, options.today)}</h2>
                  <span className="ms-auto flex gap-3 text-body-regular tabular-nums">
                    {dayFlow.income ? <span className="text-status-lime-text">+{money(dayFlow.income)}</span> : null}
                    {dayFlow.out ? <span className="text-text-secondary">−{money(dayFlow.out)}</span> : null}
                  </span>
                </div>
                <ul className="divide-y divide-separator-border overflow-hidden rounded-3xl border border-border-button-default bg-background-primary-default">
                  {items.map((r) => (
                    <TxnListItem
                      key={r.txn.id}
                      row={r}
                      money={money}
                      selected={selected.has(r.txn.id)}
                      selecting={selecting}
                      onToggle={canWrite ? () => toggle(r.txn.id) : undefined}
                      onOpen={canWrite ? () => (selecting ? toggle(r.txn.id) : setEditing(r.txn)) : undefined}
                      onDelete={canWrite ? () => removeRows([r.txn.id], `Deleted ${r.txn.description || r.categoryName || "transaction"} · ${money(r.txn.amount)}`) : undefined}
                      onEdit={canWrite ? () => setEditing(r.txn) : undefined}
                      onVerify={canWrite ? () => verifyOne(r.txn.id, !r.txn.verified) : undefined}
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
  selecting,
  onToggle,
  onOpen,
  onDelete,
  onEdit,
  onVerify,
}: {
  row: TxnRow;
  money: (n: number) => string;
  selected: boolean;
  /** A selection is under way: show the checkbox instead of the tile. */
  selecting: boolean;
  /** Omitted for read-only users. */
  onToggle?: () => void;
  /** Omitted for read-only users. */
  onOpen?: () => void;
  /** Trailing delete button (asks first); omitted for read-only users. Tapping the row edits. */
  onDelete?: () => void;
  /** Context-menu actions (right-click / long-press); omitted for read-only users. */
  onEdit?: () => void;
  onVerify?: () => void;
}) {
  const { txn } = row;
  const sign = txn.type === "income" ? "+" : txn.type === "expense" ? "−" : "";
  const title = txn.description || row.categoryName || (txn.type === "transfer" ? "Transfer" : "Untitled");
  // The tile carries the category, so the subtitle only names it when the title doesn't.
  const subtitle = [
    txn.description && row.categoryName,
    txn.type === "transfer" ? `${row.accountName || "?"} → ${row.toAccountName || "?"}` : row.accountName,
    txn.member,
  ]
    .filter(Boolean)
    .join(" · ");

  // A long-press opens the context menu; the tap that ends it must not also open the editor.
  const menuOpenedAt = useRef(0);

  const tile = (
    <span className="relative flex shrink-0">
      {row.categoryName ? (
        <CategoryIcon name={row.categoryName} emoji={row.categoryEmoji} color={row.categoryColor} group={row.group} className="size-10 rounded-full" />
      ) : (
        <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-background-tertiary-default text-foreground-icon-secondary">
          {txn.type === "transfer" ? <RiArrowLeftRightLine className="size-4" /> : <span className="text-body-medium">?</span>}
        </span>
      )}
      {/* Verified against the bank statement: a check badge on the tile's corner. */}
      {txn.verified ? (
        <span title="Verified" className="absolute -end-0.5 -bottom-0.5 flex rounded-full bg-background-primary-default">
          <RiCheckboxCircleFill className="size-4 text-status-lime-text" aria-hidden />
          <span className="sr-only">Verified</span>
        </span>
      ) : null}
    </span>
  );

  const item = (
    <li
      className={cx(
        "flex items-center gap-1 ps-4 pe-2 data-[state=open]:bg-background-secondary-default",
        selected && "bg-background-secondary-default",
      )}
    >
      {/* While selecting, the checkbox takes the tile's place. */}
      {onToggle && selecting ? (
        <div className="flex size-10 shrink-0 items-center justify-center">
          <Checkbox aria-label={`Select ${title}`} isSelected={selected} onChange={onToggle} />
        </div>
      ) : null}
      <button
        type="button"
        onClick={(e) => {
          if (Date.now() - menuOpenedAt.current < 600) return;
          if (onToggle && (e.metaKey || e.ctrlKey || e.shiftKey)) return onToggle();
          onOpen?.();
        }}
        disabled={!onOpen}
        className={cx(
          "flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-xl py-3 text-start",
          onDelete && !selecting ? "pe-1" : "pe-2",
          "outline-none select-none [-webkit-touch-callout:none] focus-visible:ring-2 focus-visible:ring-border-focus-ring focus-visible:ring-inset disabled:cursor-default",
        )}
      >
        {selecting && onToggle ? null : tile}
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-headline-medium text-text-primary">{title}</span>
          {subtitle ? <span className="truncate text-body-2-regular text-text-secondary">{subtitle}</span> : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span
            className={cx(
              "text-headline-medium tabular-nums",
              txn.type === "income" ? "text-status-lime-text" : "text-text-primary",
            )}
          >
            {sign}
            {money(txn.amount)}
          </span>
        </div>
      </button>
      {onDelete && !selecting ? (
        <button
          type="button"
          aria-label={`Delete ${title}`}
          title="Delete"
          onClick={onDelete}
          className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-foreground-icon-tertiary outline-none hover:bg-background-secondary-hover hover:text-text-error-primary focus-visible:ring-2 focus-visible:ring-border-focus-ring"
        >
          <RiDeleteBinLine className="size-4" aria-hidden />
        </button>
      ) : null}
    </li>
  );

  if (!onEdit || !onVerify || !onToggle || !onDelete) return item;
  return (
    <ContextMenu onOpenChange={(open) => open && (menuOpenedAt.current = Date.now())}>
      <ContextMenuTrigger asChild disabled={selecting}>
        {item}
      </ContextMenuTrigger>
      <ContextMenuContent className="w-52">
        <ContextMenuItem onSelect={onEdit}>
          <RiPencilLine aria-hidden />
          Edit
        </ContextMenuItem>
        <ContextMenuItem onSelect={onVerify}>
          {txn.verified ? <RiCloseCircleLine aria-hidden /> : <RiCheckDoubleLine aria-hidden />}
          {txn.verified ? "Mark unverified" : "Mark verified"}
        </ContextMenuItem>
        <ContextMenuItem onSelect={onToggle}>
          <RiCheckboxMultipleLine aria-hidden />
          Select
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem variant="destructive" onSelect={onDelete}>
          <RiDeleteBinLine aria-hidden />
          Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
