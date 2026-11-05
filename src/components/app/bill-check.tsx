"use client";

import { parseDate } from "@internationalized/date";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition, type ClipboardEvent, type ReactNode } from "react";
import {
  RiAddLine,
  RiCheckboxBlankCircleLine,
  RiCheckboxCircleFill,
  RiDeleteBinLine,
  RiEyeOffLine,
  RiImageAddLine,
  RiInboxLine,
  RiLinkUnlinkM,
  RiMagicLine,
  RiPencilLine,
} from "@remixicon/react";
import {
  addLines,
  autoMatchStatement,
  createFromLine,
  createStatement,
  deleteStatement,
  ignoreLine,
  linkLine,
  readScreenshots,
  renameLine,
  unlinkLine,
  updateStatement,
} from "@/actions/statements";
import { Chip, type ChipColor } from "@/components/base/badges/chip";
import { Button } from "@/components/base/buttons/button";
import { IconButton } from "@/components/base/buttons/icon-button";
import { DatePicker } from "@/components/base/date-picker/date-picker";
import { Input } from "@/components/base/input/input";
import { SegmentedControl, SegmentedControlItem } from "@/components/base/segmented-control/segmented-control";
import { toast } from "@/components/base/toast/toast";
import type { FormOptions } from "@/lib/data/app-data";
import { formatMoney } from "@/lib/finance/money";
import type { LineKind, Statement } from "@/lib/sheets/schema";
import { classifyLine, isCreditKind, linesTotal, looksLikeCredit, parseStatement } from "@/lib/statements/parse";
import type { LineView, TxnBrief } from "@/lib/statements/view";
import { cx } from "@/utils/cx";
import { shrinkImage } from "@/lib/ai/shrink-image";
import { DateField, MoneyField, SelectField } from "./fields";
import { shortDateClient } from "./format";
import { DrawerForm, FormDrawer, FormError } from "./form-drawer";
import { useBookHref, useBookId, useCan, useViewerMember } from "./permissions";
import { TransactionFormBody, type Draft } from "./transaction-form";

const KIND_LABEL: Record<LineKind, string> = {
  charge: "Purchase",
  installment: "Installment",
  fee: "Fee",
  interest: "Interest",
  payment: "Payment",
  refund: "Refund",
};

const KIND_CHIP: Record<LineKind, ChipColor> = {
  charge: "neutral",
  installment: "purple",
  fee: "yellow",
  interest: "rose",
  payment: "lime",
  refund: "cyan",
};

type ActionResult = { ok: true } | { ok: false; error: string };

function useRun() {
  const [pending, startTransition] = useTransition();
  const run = (fn: () => Promise<ActionResult>, success: string, after?: () => void) =>
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) return void toast(res.error, { status: "error" });
      toast(success, { status: "success" });
      after?.();
    });
  return { pending, run };
}

/* -------------------------------------------------------------------------- */
/*  Row editor: screenshots, pasted text, or typed by hand                      */
/* -------------------------------------------------------------------------- */

interface Row {
  key: number;
  date: string;
  description: string;
  amount: number | null;
  credit: boolean;
}

let rowKey = 0;
const blankRow = (): Row => ({ key: ++rowKey, date: "", description: "", amount: null, credit: false });

/** Rows ready to save; incomplete ones are left out. */
export function rowsToLines(rows: Row[]) {
  return rows
    .filter((r) => r.description.trim() && r.amount)
    .map((r) => ({
      date: r.date,
      description: r.description.trim(),
      amount: r.amount!,
      kind: classifyLine(r.description, r.credit || looksLikeCredit(r.description)),
    }));
}

function RowsEditor({
  rows,
  setRows,
  options,
  referenceDate,
}: {
  rows: Row[];
  setRows: (update: (rows: Row[]) => Row[]) => void;
  options: FormOptions;
  referenceDate: string;
}) {
  const bookId = useBookId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [reading, startReading] = useTransition();
  const [dragging, setDragging] = useState(false);
  const money = (n: number) => formatMoney(n, options.money);
  const lines = rowsToLines(rows);

  const patch = (key: number, p: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...p } : r)));
  /** Appends rows, replacing a lone empty starter row. */
  const append = (added: Row[]) =>
    setRows((rs) => [...rs.filter((r) => r.description.trim() || r.amount !== null || r.date), ...added]);

  function readImages(files: Blob[]) {
    const images = files.filter((f) => f.type.startsWith("image/"));
    if (!images.length) {
      if (files.length) toast("Only images can be read. Take a screenshot of the bill instead.", { status: "error" });
      return;
    }
    startReading(async () => {
      try {
        const res = await readScreenshots(bookId, { images: await Promise.all(images.slice(0, 6).map(shrinkImage)), reference_date: referenceDate });
        if (!res.ok) return void toast(res.error, { status: "error" });
        const read = res.data ?? [];
        if (!read.length) return void toast("No rows found in the screenshot.", { status: "error" });
        append(read.map((l) => ({ key: ++rowKey, date: l.date, description: l.description, amount: l.amount, credit: isCreditKind(l.kind) })));
        toast(`Read ${read.length} rows. Check them before saving.`, { status: "success" });
      } catch {
        toast("Couldn't open that image.", { status: "error" });
      }
    });
  }

  function onPaste(e: ClipboardEvent) {
    const files = [...e.clipboardData.files];
    if (files.some((f) => f.type.startsWith("image/"))) {
      e.preventDefault();
      return readImages(files);
    }
    // Several lines of text (from a sheet or an e-statement) become rows.
    const text = e.clipboardData.getData("text");
    if (!text.includes("\n")) return;
    const parsed = parseStatement(text, referenceDate);
    if (!parsed.length) return;
    e.preventDefault();
    append(parsed.map((l) => ({ key: ++rowKey, date: l.date, description: l.description, amount: l.amount, credit: isCreditKind(l.kind) })));
  }

  return (
    <section aria-label="Bill rows" className="flex flex-col gap-3" onPaste={onPaste}>
      <div
        onDragOver={(e) => {
          if (![...e.dataTransfer.types].includes("Files")) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
          setDragging(true);
        }}
        onDragLeave={(e) => {
          // Leaving into a child still counts as inside the zone.
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          readImages([...e.dataTransfer.files]);
        }}
        className={cx(
          "flex flex-col gap-2 rounded-2xl border border-dashed p-4 text-center transition-colors duration-150",
          dragging ? "border-accent-500 bg-background-secondary-default" : "border-border-button-default",
        )}
      >
        <p className="text-body-2-regular text-text-secondary">
          {dragging
            ? "Drop the screenshots to read them."
            : "Drop or upload screenshots of the bill and the rows fill in for you. You can also paste a screenshot or copied rows here."}
        </p>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            readImages([...(e.target.files ?? [])]);
            e.target.value = "";
          }}
        />
        <Button type="button" variant="secondary" leadingIcon={RiImageAddLine} disabled={reading} onClick={() => fileRef.current?.click()} className="self-center">
          {reading ? "Reading screenshots…" : "Upload screenshots"}
        </Button>
      </div>

      <ul className="flex flex-col gap-2">
        {rows.map((r, i) => {
          const kind = r.description.trim() ? classifyLine(r.description, r.credit || looksLikeCredit(r.description)) : "charge";
          return (
            <li key={r.key} className="grid grid-cols-[1fr_auto] gap-2 rounded-2xl border border-border-button-default p-2 sm:grid-cols-[9.5rem_1fr_9rem_auto] sm:items-center">
              <Input
                aria-label={`Row ${i + 1} name`}
                placeholder="Name, e.g. Ayam Pak Gembus"
                value={r.description}
                onChange={(v) => patch(r.key, { description: v })}
                size="small"
                className="col-span-2 sm:order-2 sm:col-span-1"
              />
              <RowDate value={r.date} onChange={(v) => patch(r.key, { date: v })} label={`Row ${i + 1} date`} />
              <div className="flex items-center gap-2 sm:order-3">
                <MoneyField aria-label={`Row ${i + 1} amount`} value={r.amount} onChange={(v) => patch(r.key, { amount: v })} money={options.money} className="min-w-0 flex-1" />
              </div>
              <div className="col-span-2 flex items-center justify-between gap-2 sm:order-4 sm:col-span-1">
                {kind !== "charge" ? (
                  <Chip variant="caption" color={KIND_CHIP[kind]} className="sm:hidden">
                    {KIND_LABEL[kind]}
                  </Chip>
                ) : (
                  <span className="sm:hidden" />
                )}
                <IconButton icon={RiDeleteBinLine} size="small" aria-label={`Remove row ${i + 1}`} onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))} />
              </div>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button type="button" variant="ghost" leadingIcon={RiAddLine} onClick={() => setRows((rs) => [...rs, blankRow()])}>
          Add row
        </Button>
        {lines.length ? (
          <span className="text-body-2-medium text-text-secondary tabular-nums">
            {lines.length} rows · {money(linesTotal(lines))}
          </span>
        ) : null}
      </div>
    </section>
  );
}

function RowDate({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  let parsed = null;
  try {
    parsed = value ? parseDate(value) : null;
  } catch {
    parsed = null;
  }
  return (
    <div className="sm:order-1">
      <DatePicker aria-label={label} value={parsed} onChange={(d) => onChange(d ? d.toString() : "")} />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  New bill                                                                   */
/* -------------------------------------------------------------------------- */

export function NewBillButton({ options, feeCategoryId }: { options: FormOptions; feeCategoryId: string }) {
  const [open, setOpen] = useState(false);
  if (!useCan("data:write")) return null;
  return (
    <>
      <Button variant="primary" leadingIcon={RiAddLine} onClick={() => setOpen(true)}>
        New bill
      </Button>
      <FormDrawer isOpen={open} onOpenChange={setOpen} aria-label="New bill" size="lg">
        <NewBillForm options={options} feeCategoryId={feeCategoryId} />
      </FormDrawer>
    </>
  );
}

function NewBillForm({ options, feeCategoryId }: { options: FormOptions; feeCategoryId: string }) {
  const bookId = useBookId();
  const href = useBookHref();
  const router = useRouter();
  const money = (n: number) => formatMoney(n, options.money);
  const [date, setDate] = useState(options.today);
  const [name, setName] = useState(`Jenius CC ${monthName(options.today)}`);
  const [total, setTotal] = useState<number | null>(null);
  const [rows, setRows] = useState<Row[]>(() => [blankRow()]);
  const [feeCategory, setFeeCategory] = useState(feeCategoryId);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const lines = rowsToLines(rows);
  const sum = linesTotal(lines);
  const fees = lines.filter((l) => l.kind === "fee" || l.kind === "interest");
  const expenseCategories = options.categories.filter((c) => c.kind === "expense").map((c) => ({ id: c.id, label: `${c.name} · ${c.group}` }));

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await createStatement(bookId, { name, statement_date: date, total_amount: total, lines, fee_category_id: feeCategory });
      if (!res.ok || !res.data) return setError(res.ok ? "Something went wrong." : res.error);
      toast(`Bill saved · ${res.data.matched} matched automatically`, { status: "success" });
      router.push(href(`/bill-check/${res.data.id}`));
    });
  }

  return (
    <DrawerForm
      title="New bill"
      description="Add the bill's rows, then each one is checked against what you recorded."
      onSubmit={submit}
      footer={
        <>
          <span className="hidden sm:block" />
          <Button type="submit" variant="primary" disabled={pending || lines.length === 0}>
            {pending ? "Checking…" : lines.length ? `Save and check ${lines.length} rows` : "Save and check"}
          </Button>
        </>
      }
    >
      <Input label="Name" value={name} onChange={setName} />
      <div className="grid gap-4 sm:grid-cols-2">
        <DateField label="Bill date" value={date} onChange={setDate} />
        <MoneyField label="Bill total (optional)" value={total} onChange={setTotal} money={options.money} />
      </div>
      {total !== null && lines.length && total !== sum ? (
        <p className="text-body-2-regular text-text-secondary">
          Rows add up to {money(sum)}, {money(Math.abs(total - sum))} {total > sum ? "short of" : "over"} the bill total.
        </p>
      ) : null}
      <RowsEditor rows={rows} setRows={setRows} options={options} referenceDate={date} />
      {fees.length > 0 ? (
        <SelectField
          label={`Record ${fees.length} fee and interest row${fees.length === 1 ? "" : "s"} under`}
          value={feeCategory}
          onChange={setFeeCategory}
          options={expenseCategories}
          allowEmpty="Don't record them"
          searchable
        />
      ) : null}
      <FormError>{error}</FormError>
    </DrawerForm>
  );
}

function monthName(iso: string) {
  const [y, m] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", { month: "short", year: "numeric", timeZone: "UTC" }).format(Date.UTC(y, m - 1, 1));
}

/* -------------------------------------------------------------------------- */
/*  Bill header actions                                                        */
/* -------------------------------------------------------------------------- */

export function BillActions({ statement, options, toCheck }: { statement: Statement; options: FormOptions; toCheck: number }) {
  const bookId = useBookId();
  const canWrite = useCan("data:write");
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const { pending, run } = useRun();
  if (!canWrite) return null;

  function autoMatch() {
    let matched = 0;
    run(
      async () => {
        const res = await autoMatchStatement(bookId, { id: statement.id });
        if (res.ok) matched = res.data?.matched ?? 0;
        return res;
      },
      "Check finished",
      () => matched === 0 && toast("No new sure matches. Pick the rest by hand.", { status: "information" }),
    );
  }

  return (
    <>
      {toCheck > 0 && statement.status === "open" ? (
        <Button variant="secondary" leadingIcon={RiMagicLine} disabled={pending} onClick={autoMatch}>
          {pending ? "Checking…" : "Auto-match"}
        </Button>
      ) : null}
      <Button variant="secondary" leadingIcon={RiAddLine} onClick={() => setAdding(true)}>
        Add rows
      </Button>
      <Button variant="secondary" leadingIcon={RiPencilLine} onClick={() => setEditing(true)}>
        Edit
      </Button>
      <FormDrawer isOpen={adding} onOpenChange={setAdding} aria-label="Add rows" size="lg">
        <AddRowsForm statement={statement} options={options} onDone={() => setAdding(false)} />
      </FormDrawer>
      <FormDrawer isOpen={editing} onOpenChange={setEditing} aria-label="Edit bill">
        <EditBillForm statement={statement} options={options} onDone={() => setEditing(false)} />
      </FormDrawer>
    </>
  );
}

function AddRowsForm({ statement, options, onDone }: { statement: Statement; options: FormOptions; onDone: () => void }) {
  const bookId = useBookId();
  const [rows, setRows] = useState<Row[]>(() => [blankRow()]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const lines = rowsToLines(rows);

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await addLines(bookId, { id: statement.id, lines });
      if (!res.ok) return setError(res.error);
      toast(`${lines.length} rows added · ${res.data?.matched ?? 0} matched`, { status: "success" });
      onDone();
    });
  }

  return (
    <DrawerForm
      title="Add rows"
      description={statement.name}
      onSubmit={submit}
      footer={
        <>
          <span className="hidden sm:block" />
          <Button type="submit" variant="primary" disabled={pending || lines.length === 0}>
            {pending ? "Checking…" : "Add and check"}
          </Button>
        </>
      }
    >
      <RowsEditor rows={rows} setRows={setRows} options={options} referenceDate={statement.statement_date} />
      <FormError>{error}</FormError>
    </DrawerForm>
  );
}

function EditBillForm({ statement, options, onDone }: { statement: Statement; options: FormOptions; onDone: () => void }) {
  const bookId = useBookId();
  const href = useBookHref();
  const router = useRouter();
  const [name, setName] = useState(statement.name);
  const [date, setDate] = useState(statement.statement_date);
  const [total, setTotal] = useState<number | null>(statement.total_amount);
  const [status, setStatus] = useState(statement.status);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await updateStatement(bookId, { id: statement.id, name, statement_date: date, total_amount: total, status });
      if (!res.ok) return setError(res.error);
      toast("Bill updated", { status: "success" });
      onDone();
    });
  }

  function destroy() {
    startTransition(async () => {
      const res = await deleteStatement(bookId, { id: statement.id });
      if (!res.ok) return setError(res.error);
      toast("Bill deleted; its matches are unverified again", { status: "success" });
      router.push(href("/bill-check"));
    });
  }

  return (
    <DrawerForm
      title="Edit bill"
      onSubmit={submit}
      footer={
        <>
          <Button type="button" variant="danger" leadingIcon={RiDeleteBinLine} onClick={destroy} disabled={pending}>
            Delete
          </Button>
          <Button type="submit" variant="primary" disabled={pending}>
            {pending ? "Saving…" : "Save changes"}
          </Button>
        </>
      }
    >
      <Input label="Name" value={name} onChange={setName} />
      <DateField label="Bill date" value={date} onChange={setDate} />
      <MoneyField label="Bill total" value={total} onChange={setTotal} money={options.money} />
      <SelectField
        label="Status"
        value={status}
        onChange={(v) => setStatus(v === "closed" ? "closed" : "open")}
        options={[
          { id: "open", label: "Open: still checking" },
          { id: "closed", label: "Done: all accounted for" },
        ]}
      />
      <FormError>{error}</FormError>
    </DrawerForm>
  );
}

/* -------------------------------------------------------------------------- */
/*  Rows of a saved bill                                                       */
/* -------------------------------------------------------------------------- */

type Filter = "check" | "matched" | "ignored" | "all";

export function BillRows({ views, pickable, options }: { views: LineView[]; pickable: TxnBrief[]; options: FormOptions }) {
  const canWrite = useCan("data:write");
  const money = (n: number) => formatMoney(n, options.money);
  const counts = {
    check: views.filter((v) => v.line.status === "unmatched").length,
    matched: views.filter((v) => v.line.status === "matched").length,
    ignored: views.filter((v) => v.line.status === "ignored").length,
    all: views.length,
  };
  const [filter, setFilter] = useState<Filter>(counts.check ? "check" : "all");
  const [openLine, setOpenLine] = useState<string | null>(null);
  const shown = views.filter(
    (v) =>
      filter === "all" ||
      (filter === "check" && v.line.status === "unmatched") ||
      (filter === "matched" && v.line.status === "matched") ||
      (filter === "ignored" && v.line.status === "ignored"),
  );
  const active = views.find((v) => v.line.id === openLine);

  return (
    <section className="flex flex-col gap-4">
      <SegmentedControl
        aria-label="Show"
        selectedKeys={[filter]}
        onSelectionChange={(keys) => {
          const k = [...keys][0] as Filter | undefined;
          if (k) setFilter(k);
        }}
        className="max-w-full self-start overflow-x-auto"
      >
        <SegmentedControlItem id="check">To check · {counts.check}</SegmentedControlItem>
        <SegmentedControlItem id="matched">Matched · {counts.matched}</SegmentedControlItem>
        <SegmentedControlItem id="ignored">Ignored · {counts.ignored}</SegmentedControlItem>
        <SegmentedControlItem id="all">All · {counts.all}</SegmentedControlItem>
      </SegmentedControl>

      {shown.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-3xl border border-dashed border-border-button-default py-16 text-center">
          <RiInboxLine className="size-6 text-foreground-icon-tertiary" aria-hidden />
          <p className="text-body-medium text-text-secondary">{filter === "check" ? "Every row is accounted for." : "Nothing here."}</p>
        </div>
      ) : (
        <ul className="glass divide-y divide-separator-border overflow-hidden rounded-3xl border border-border-button-default bg-background-primary-default">
          {shown.map((v) => (
            <BillRow key={v.line.id} view={v} money={money} canWrite={canWrite} onOpen={canWrite ? () => setOpenLine(v.line.id) : undefined} />
          ))}
        </ul>
      )}

      <FormDrawer isOpen={active !== undefined} onOpenChange={(o) => !o && setOpenLine(null)} aria-label="Bill row" size="lg">
        {active ? <RowForm view={active} pickable={pickable} options={options} onDone={() => setOpenLine(null)} /> : null}
      </FormDrawer>
    </section>
  );
}

/** One bill row: status, date, name, amount. The name can be fixed in place from the pencil that shows on hover. */
function BillRow({ view, money, canWrite, onOpen }: { view: LineView; money: (n: number) => string; canWrite: boolean; onOpen?: () => void }) {
  const { line, match } = view;
  const bookId = useBookId();
  const credit = isCreditKind(line.kind);
  const date = line.date || match?.date;
  const ignored = line.status === "ignored";
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(line.description);
  const [saving, startSaving] = useTransition();
  // Enter saves, then the field disables and blurs; the blur must not save a second time.
  const busy = useRef(false);

  function save() {
    if (busy.current) return;
    const next = name.trim();
    if (!next || next === line.description) {
      setName(line.description);
      return setEditing(false);
    }
    busy.current = true;
    startSaving(async () => {
      const res = await renameLine(bookId, { lineId: line.id, description: next });
      busy.current = false;
      if (!res.ok) return void toast(res.error, { status: "error" });
      toast("Row renamed", { status: "success" });
      setEditing(false);
    });
  }

  const status =
    line.status === "matched" ? (
      <RiCheckboxCircleFill className="size-5 shrink-0 text-status-lime-text" aria-label="Matched" />
    ) : ignored ? (
      <RiEyeOffLine className="size-5 shrink-0 text-foreground-icon-quaternary" aria-label="Ignored" />
    ) : (
      <RiCheckboxBlankCircleLine className="size-5 shrink-0 text-foreground-icon-tertiary" aria-label="To check" />
    );
  const dateCell = <span className="w-14 shrink-0 text-body-2-regular text-text-tertiary tabular-nums">{date ? shortDateClient(date) : "–"}</span>;
  const amount = (
    <span className={cx("shrink-0 text-body-semibold tabular-nums", credit ? "text-status-lime-text" : "text-text-primary", ignored && "text-text-tertiary line-through")}>
      {credit ? "+" : ""}
      {money(line.amount)}
    </span>
  );

  if (editing) {
    return (
      <li className="flex items-center gap-3 px-4 py-2">
        {status}
        {dateCell}
        <Input
          aria-label="Row name"
          value={name}
          onChange={setName}
          autoFocus
          onFocus={(e) => e.target.select()}
          size="small"
          maxLength={200}
          isDisabled={saving}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              save();
            } else if (e.key === "Escape") {
              e.preventDefault();
              setName(line.description);
              setEditing(false);
            }
          }}
          className="min-w-0 flex-1"
        />
        {amount}
      </li>
    );
  }

  return (
    <li className="group flex items-center">
      <button
        type="button"
        onClick={onOpen}
        disabled={!onOpen}
        className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 py-3 ps-4 text-start outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-border-focus-ring disabled:cursor-default"
      >
        {status}
        {dateCell}
        <span className={cx("min-w-0 flex-1 truncate text-body-medium", ignored ? "text-text-tertiary" : "text-text-primary")}>{line.description}</span>
        {amount}
      </button>
      {canWrite ? (
        <IconButton
          icon={RiPencilLine}
          size="small"
          aria-label={`Rename ${line.description}`}
          onClick={() => {
            setName(line.description);
            setEditing(true);
          }}
          className="mx-2 shrink-0 transition-opacity duration-150 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
        />
      ) : (
        <span className="pe-4" />
      )}
    </li>
  );
}

function RowForm({ view, pickable, options, onDone }: { view: LineView; pickable: TxnBrief[]; options: FormOptions; onDone: () => void }) {
  const bookId = useBookId();
  const { line, match, suggestions } = view;
  const money = (n: number) => formatMoney(n, options.money);
  const credit = isCreditKind(line.kind);
  const { pending, run } = useRun();
  const [picked, setPicked] = useState("");
  const kind = credit ? "income" : "expense";
  const member = useViewerMember();
  const [creating, setCreating] = useState(false);

  const pickOptions = pickable
    .filter((t) => t.type === kind)
    .sort((a, b) => Number(b.amount === line.amount) - Number(a.amount === line.amount) || b.date.localeCompare(a.date))
    .map((t) => ({
      id: t.id,
      label: [shortDateClient(t.date), t.description || t.categoryName || "Untitled", money(t.amount), t.bookName].filter(Boolean).join(" · "),
    }));
  const link = (transactionKey: string) => run(() => linkLine(bookId, { lineId: line.id, transactionKey }), "Matched and marked verified", onDone);
  const summary = [line.date ? shortDateClient(line.date) : "", `${credit ? "+" : ""}${money(line.amount)}`].filter(Boolean).join(" · ");

  if (creating) {
    // Not in the records yet: the full transaction form, filled in from the bill row.
    const draft: Draft = {
      date: line.date || options.today,
      type: kind,
      amount: line.amount,
      category_id: "",
      from_category_id: "",
      account_id: "",
      to_account_id: "",
      member: options.members.includes(member) ? member : "",
      description: line.description,
      verified: true,
      installment_id: "",
    };
    return (
      <TransactionFormBody
        options={options}
        initial={draft}
        title="Record this row"
        description={`It's matched to ${line.description} and marked verified.`}
        save={(transaction) => createFromLine(bookId, { lineId: line.id, transaction })}
        onDone={onDone}
      />
    );
  }

  return (
    <DrawerForm
      title={line.description}
      description={summary}
      // Nothing to submit here: matching happens on its own buttons, and creating opens the full form.
      onSubmit={() => undefined}
      footer={
        line.status === "matched" ? (
          <>
            <span className="hidden sm:block" />
            <Button type="button" variant="secondary" leadingIcon={RiLinkUnlinkM} disabled={pending} onClick={() => run(() => unlinkLine(bookId, { lineId: line.id }), "Unlinked; the transaction is unverified again", onDone)}>
              Unlink
            </Button>
          </>
        ) : (
          <>
            <Button
              type="button"
              variant="ghost"
              leadingIcon={RiEyeOffLine}
              disabled={pending}
              onClick={() =>
                run(() => ignoreLine(bookId, { lineId: line.id, ignored: line.status !== "ignored" }), line.status === "ignored" ? "Back on the to-check list" : "Ignored", onDone)
              }
            >
              {line.status === "ignored" ? "Stop ignoring" : "Ignore row"}
            </Button>
            {line.status === "unmatched" ? (
              <Button type="button" variant="primary" leadingIcon={RiAddLine} disabled={pending} onClick={() => setCreating(true)}>
                Create transaction
              </Button>
            ) : null}
          </>
        )
      }
    >
      {line.status === "matched" ? (
        match ? (
          <section className="flex flex-col gap-2">
            <h3 className="text-body-semibold text-text-primary">Matched with</h3>
            <TxnCard txn={match} money={money} />
          </section>
        ) : (
          <p className="text-body-regular text-text-secondary">The matched transaction was deleted. Unlink this row and match it again.</p>
        )
      ) : (
        <>
          {suggestions.length ? (
            <section className="flex flex-col gap-2">
              <h3 className="text-body-semibold text-text-primary">Possible matches</h3>
              {suggestions.map((t) => (
                <TxnCard
                  key={t.id}
                  txn={t}
                  money={money}
                  action={
                    <Button type="button" size="small" variant="primary" disabled={pending} onClick={() => link(t.id)}>
                      Match
                    </Button>
                  }
                />
              ))}
            </section>
          ) : (
            <p className="text-body-regular text-text-secondary">
              Nothing recorded with this exact amount around the bill date. If it was never entered, create the transaction from this row.
            </p>
          )}

          <section className="flex flex-col gap-2">
            <h3 className="text-body-semibold text-text-primary">Pick another transaction</h3>
            <div className="flex items-end gap-2">
              <SelectField aria-label="Transaction" value={picked} onChange={setPicked} options={pickOptions} placeholder="Search by name or amount" searchable />
              <Button type="button" variant="secondary" disabled={pending || !picked} onClick={() => link(picked)}>
                Match
              </Button>
            </div>
          </section>
        </>
      )}
    </DrawerForm>
  );
}

/** A recorded transaction: date, name, amount, and its book when it isn't this one. */
function TxnCard({ txn, money, action }: { txn: TxnBrief; money: (n: number) => string; action?: ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border-button-default px-3 py-2">
      <span className="w-14 shrink-0 text-body-2-regular text-text-tertiary tabular-nums">{shortDateClient(txn.date)}</span>
      <span className="min-w-0 flex-1 truncate text-body-medium text-text-primary">{txn.description || txn.categoryName || "Untitled"}</span>
      {txn.bookName ? (
        <Chip variant="caption" color="soft" className="shrink-0">
          {txn.bookName}
        </Chip>
      ) : null}
      <span className="shrink-0 text-body-semibold text-text-primary tabular-nums">{money(txn.amount)}</span>
      {action}
    </div>
  );
}
