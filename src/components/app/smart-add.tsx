"use client";

import { parseDate } from "@internationalized/date";
import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { RiDeleteBinLine, RiErrorWarningLine, RiSparkling2Line } from "@remixicon/react";
import { draftWithAI, type DraftWithCheck } from "@/actions/smart-add";
import { saveTransactions } from "@/actions/transactions";
import { SmartComposer, type Attachment } from "@/components/ai/smart-composer";
import { CHIP_COLORS } from "@/components/base/badges/chip";
import { Button } from "@/components/base/buttons/button";
import { IconButton } from "@/components/base/buttons/icon-button";
import { DatePicker } from "@/components/base/date-picker/date-picker";
import { Input } from "@/components/base/input/input";
import { toast } from "@/components/base/toast/toast";
import type { DraftForPrompt, Turn } from "@/lib/ai/smart-add";
import { loadHistory, saveHistory } from "@/lib/ai/catat-history";
import { shrinkImage } from "@/lib/ai/shrink-image";
import type { FormOptions } from "@/lib/data/app-data";
import { formatMoney } from "@/lib/finance/money";
import { cx } from "@/utils/cx";
import { MoneyField, SelectField } from "./fields";
import { shortDateClient } from "./format";

export interface SmartAddBook {
  id: string;
  name: string;
  options: FormOptions;
}

interface ChatTurn extends Turn {
  id: number;
  /** Object URLs for this visit only; not kept in history. */
  previews?: string[];
  /** How many images were attached (survives a reload, unlike previews). */
  imageCount?: number;
  failed?: boolean;
}

type Row = DraftWithCheck & { key: number };

let seq = 0;

const EXAMPLES = ["makan siang padang 35rb pakai jago", "kemarin grab ke kantor 24rb, kopi 18rb", "gaji masuk 6jt"];

const TYPE_OPTIONS = [
  { id: "expense", label: "Expense" },
  { id: "income", label: "Income" },
  { id: "transfer", label: "Transfer" },
];

/** What a row is missing before it can be saved, or null. */
function problem(r: Row): string | null {
  if (!r.amount) return "Enter an amount";
  if (r.type === "transfer") {
    if (!r.from_category_id || !r.category_id) return "Pick both categories";
    if (r.from_category_id === r.category_id) return "Pick two different categories";
  } else if (!r.category_id) return "Pick a category";
  return r.description.trim() ? null : "Enter a description";
}

const noopSubscribe = () => () => {};

/**
 * Renders once in the browser, so the last 24 hours of conversation can be
 * read from local storage on first render (no flash, no hydration mismatch).
 */
export function SmartAdd(props: { books: SmartAddBook[]; initialBookId: string }) {
  const inBrowser = useSyncExternalStore(noopSubscribe, () => true, () => false);
  if (!inBrowser) return <div aria-hidden className="h-72 animate-pulse rounded-3xl bg-background-secondary-default" />;
  return <SmartAddSession {...props} />;
}

function SmartAddSession({ books, initialBookId }: { books: SmartAddBook[]; initialBookId: string }) {
  const [restored] = useState(() => {
    const snap = loadHistory<ChatTurn, Row>(initialBookId);
    if (!snap) return null;
    seq = Math.max(seq, ...snap.turns.map((t) => t.id), ...snap.rows.map((r) => r.key));
    return snap;
  });
  const [bookId, setBookId] = useState(restored && books.some((b) => b.id === restored.bookId) ? restored.bookId : initialBookId);
  const [turns, setTurns] = useState<ChatTurn[]>(restored?.turns ?? []);
  const [rows, setRows] = useState<Row[]>(restored?.rows ?? []);
  const [thinking, startThinking] = useTransition();
  const [saving, startSaving] = useTransition();
  const draftsRef = useRef<HTMLDivElement>(null);

  // Keep the session for 24 hours. Writes wait while the AI is answering,
  // so one exchange is one small write.
  useEffect(() => {
    if (thinking) return;
    saveHistory(initialBookId, {
      bookId,
      turns: turns.map(({ previews, ...t }) => ({ ...t, imageCount: t.imageCount ?? previews?.length })),
      rows,
    });
  }, [initialBookId, bookId, turns, rows, thinking]);
  const book = books.find((b) => b.id === bookId) ?? books[0];
  const options = book.options;
  const money = (n: number) => formatMoney(n, options.money);

  /** Drafts by name, so the AI can carry them across a book switch. */
  const forPrompt = (list: Row[], opts: FormOptions): DraftForPrompt[] =>
    list.map((r) => ({
      date: r.date,
      type: r.type,
      amount: r.amount,
      category: opts.categories.find((c) => c.id === r.category_id)?.name ?? "",
      from_category: opts.categories.find((c) => c.id === r.from_category_id)?.name ?? "",
      account: opts.accounts.find((a) => a.id === r.account_id)?.name ?? "",
      to_account: opts.accounts.find((a) => a.id === r.to_account_id)?.name ?? "",
      description: r.description,
      member: r.member,
    }));

  function ask(targetBookId: string, nextTurns: ChatTurn[], images: { media_type: "image/jpeg"; data: string }[], remap: boolean, fromOptions: FormOptions) {
    startThinking(async () => {
      const res = await draftWithAI(targetBookId, {
        turns: nextTurns.filter((t) => !t.failed).map(({ role, text }) => ({ role, text })),
        images,
        drafts: forPrompt(rows, fromOptions),
        remap,
      });
      if (!res.ok || !res.data) {
        const error = res.ok ? "No answer from the AI." : res.error;
        setTurns((ts) => [...ts, { id: ++seq, role: "assistant", text: error, failed: true }]);
        return;
      }
      const { reply, drafts } = res.data;
      setTurns((ts) => [...ts, { id: ++seq, role: "assistant", text: reply || (drafts.length ? `${drafts.length} drafts ready to check.` : "Nothing to add from that.") }]);
      setRows(drafts.map((d) => ({ ...d, key: ++seq })));
      if (drafts.length) requestAnimationFrame(() => draftsRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
    });
  }

  function send(text: string, attachments: Attachment[]) {
    startThinking(async () => {
      let images: { media_type: "image/jpeg"; data: string }[] = [];
      try {
        images = await Promise.all(attachments.map((a) => shrinkImage(a.file)));
      } catch {
        toast("Couldn't open one of the images.", { status: "error" });
        return;
      }
      const label = text || `(${attachments.length} image${attachments.length === 1 ? "" : "s"})`;
      const userTurn: ChatTurn = {
        id: ++seq,
        role: "user",
        text: label,
        previews: attachments.map((a) => a.preview),
        imageCount: attachments.length,
      };
      const next = [...turns, userTurn];
      setTurns(next);
      ask(bookId, next, images, false, options);
    });
  }

  function switchBook(nextId: string) {
    if (!nextId || nextId === bookId) return;
    const fromOptions = options;
    setBookId(nextId);
    // Re-pick categories and accounts from the new book's lists.
    if (rows.length) ask(nextId, turns, [], true, fromOptions);
  }

  const patch = (key: number, p: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...p } : r)));

  const invalid = rows.filter((r) => problem(r) !== null).length;
  const total = rows.reduce((s, r) => s + (r.type === "income" ? r.amount : r.type === "expense" ? -r.amount : 0), 0);

  function save() {
    startSaving(async () => {
      const res = await saveTransactions(bookId, {
        transactions: rows.map((r) => ({
          date: r.date,
          type: r.type,
          amount: r.amount,
          category_id: r.category_id,
          from_category_id: r.type === "transfer" ? r.from_category_id : "",
          account_id: r.type === "transfer" ? "" : r.account_id,
          to_account_id: "",
          member: r.member,
          description: r.description,
          verified: false,
          installment_id: "",
        })),
      });
      if (!res.ok) return void toast(res.error, { status: "error" });
      toast(`Saved ${rows.length} transaction${rows.length === 1 ? "" : "s"} to ${book.name}`, { status: "success" });
      setRows([]);
      setTurns([]);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <SelectField
          label="Save to"
          value={bookId}
          onChange={switchBook}
          options={books.map((b) => ({ id: b.id, label: b.name }))}
          className="sm:w-64"
          size="sm"
        />
        {turns.length ? (
          <Button variant="ghost" size="small" onClick={() => (setTurns([]), setRows([]))} disabled={thinking || saving}>
            Start over
          </Button>
        ) : null}
      </div>

      {turns.length === 0 ? (
        <section className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-border-button-default px-4 py-10 text-center">
          <RiSparkling2Line className="size-7 text-accent-500" aria-hidden />
          <h2 className="text-title-3-semibold text-text-primary">What did you spend?</h2>
          <p className="max-w-md text-body-2-regular text-text-tertiary">
            Type it the way you&apos;d text it, tap the mic and say it, or attach a receipt or transfer screenshot. Nothing is saved until you check
            the drafts.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {EXAMPLES.map((e) => (
              <button
                key={e}
                type="button"
                disabled={thinking}
                onClick={() => send(e, [])}
                className="rounded-full border border-border-button-default bg-background-primary-default px-3 py-1.5 text-body-2-medium text-text-secondary outline-none hover:bg-background-primary-hover focus-visible:ring-2 focus-visible:ring-border-focus-ring"
              >
                {e}
              </button>
            ))}
          </div>
        </section>
      ) : (
        <ol aria-label="Conversation" aria-live="polite" className="flex flex-col gap-2">
          {turns.map((t) => (
            <li key={t.id} className={cx("flex flex-col gap-1", t.role === "user" ? "items-end" : "items-start")}>
              {!t.previews?.length && t.imageCount ? (
                <span className="rounded-lg bg-background-secondary-default px-2 py-1 text-caption-1-medium text-text-tertiary">
                  {t.imageCount} image{t.imageCount === 1 ? "" : "s"} attached
                </span>
              ) : null}
              {t.previews?.length ? (
                <div className="flex flex-wrap justify-end gap-1.5">
                  {t.previews.map((src) => (
                    // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
                    <img key={src} src={src} alt="Attached image" className="size-16 rounded-xl border border-border-button-default object-cover" />
                  ))}
                </div>
              ) : null}
              <p
                className={cx(
                  "max-w-[85%] rounded-2xl px-3 py-2 text-body-regular",
                  t.role === "user"
                    ? "bg-linear-to-b from-accent-500 to-accent-600 text-text-white"
                    : t.failed
                      ? "border border-border-error-default bg-background-primary-default text-text-error-primary"
                      : "border border-border-button-default bg-background-primary-default text-text-primary",
                )}
              >
                {t.text}
              </p>
            </li>
          ))}
          {thinking ? (
            <li className="flex items-start">
              <p className="animate-pulse rounded-2xl border border-border-button-default bg-background-primary-default px-3 py-2 text-body-regular text-text-tertiary">
                Reading…
              </p>
            </li>
          ) : null}
        </ol>
      )}

      {rows.length ? (
        <section
          ref={draftsRef}
          aria-label="Drafts"
          className="glass flex flex-col gap-3 rounded-3xl border border-border-button-default bg-background-primary-default p-3 sm:p-4"
        >
          <header className="flex flex-wrap items-center justify-between gap-2 px-1">
            <h2 className="text-headline-semibold text-text-primary">
              {rows.length} draft{rows.length === 1 ? "" : "s"} for {book.name}
            </h2>
            <span className="text-body-2-medium text-text-secondary tabular-nums">Net {money(total)}</span>
          </header>
          <ul className="flex flex-col gap-2">
            {rows.map((r) => (
              <DraftRow key={r.key} row={r} options={options} money={money} onChange={(p) => patch(r.key, p)} onRemove={() => setRows((rs) => rs.filter((x) => x.key !== r.key))} />
            ))}
          </ul>
          <footer className="flex flex-wrap items-center justify-between gap-2 px-1">
            <span className="text-body-2-regular text-text-tertiary">
              {invalid ? `${invalid} draft${invalid === 1 ? "" : "s"} need${invalid === 1 ? "s" : ""} a fix.` : "Correct anything here or just tell the AI below."}
            </span>
            <Button variant="primary" onClick={save} disabled={saving || thinking || invalid > 0}>
              {saving ? "Saving…" : `Save ${rows.length} to ${book.name}`}
            </Button>
          </footer>
        </section>
      ) : null}

      <SmartComposer
        onSend={send}
        busy={thinking || saving}
        speechLang={options.money.locale}
        placeholder={rows.length ? "Correct a draft, e.g. “yang kedua Wants”, or add more" : undefined}
        onError={(m) => toast(m, { status: "error" })}
      />
      <p className="text-center text-caption-1-medium text-text-tertiary">
        Messages and images are read by DeepSeek. Prefer the form?{" "}
        <Link href={`/b/${bookId}/transactions`} className="text-accent-600 underline-offset-2 hover:underline dark:text-accent-400">
          Add manually
        </Link>
      </p>
    </div>
  );
}

function DraftRow({
  row,
  options,
  money,
  onChange,
  onRemove,
}: {
  row: Row;
  options: FormOptions;
  money: (n: number) => string;
  onChange: (p: Partial<Row>) => void;
  onRemove: () => void;
}) {
  const kind = row.type === "income" ? "income" : "expense";
  const categoryOptions =
    row.type === "transfer"
      ? options.categories.map((c) => ({ id: c.id, label: `${c.name} · ${c.group}` }))
      : options.categories.filter((c) => c.kind === kind).map((c) => ({ id: c.id, label: `${c.name} · ${c.group}` }));
  const accountOptions = options.accounts.map((a) => ({ id: a.id, label: a.name }));
  const issue = problem(row);
  let date = null;
  try {
    date = parseDate(row.date);
  } catch {
    date = null;
  }

  return (
    <li className={cx("flex flex-col gap-2 rounded-2xl border p-3", issue ? "border-border-error-default" : "border-border-button-default")}>
      <div className="flex items-start gap-2">
        <Input
          aria-label="Description"
          value={row.description}
          onChange={(v) => onChange({ description: v })}
          placeholder="Description"
          size="small"
          className="min-w-0 flex-1"
        />
        <IconButton icon={RiDeleteBinLine} size="small" aria-label={`Remove ${row.description || "draft"}`} onClick={onRemove} />
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <MoneyField aria-label="Amount" value={row.amount || null} onChange={(v) => onChange({ amount: v ?? 0 })} money={options.money} />
        <DatePicker aria-label="Date" value={date} onChange={(d) => onChange({ date: d ? d.toString() : row.date })} />
        <SelectField
          aria-label="Type"
          value={row.type}
          onChange={(v) => onChange({ type: (v || "expense") as Row["type"], category_id: "", from_category_id: "" })}
          options={TYPE_OPTIONS}
          size="sm"
        />
        {row.type === "transfer" ? (
          <SelectField
            aria-label="From category"
            value={row.from_category_id ?? ""}
            onChange={(v) => onChange({ from_category_id: v })}
            options={categoryOptions}
            placeholder="From category"
            size="sm"
            searchable
          />
        ) : null}
        <SelectField
          aria-label={row.type === "transfer" ? "To category" : "Category"}
          value={row.category_id}
          onChange={(v) => onChange({ category_id: v })}
          options={categoryOptions}
          placeholder={row.type === "transfer" ? "To category" : "Category"}
          size="sm"
          searchable
        />
        {row.type === "transfer" ? null : (
          <SelectField
            aria-label="Account"
            value={row.account_id}
            onChange={(v) => onChange({ account_id: v })}
            options={accountOptions}
            allowEmpty="Category default"
            placeholder="Account"
            size="sm"
            className="col-span-2 sm:col-span-2"
          />
        )}
        {row.type === "transfer" ? (
          options.members.length ? (
            <SelectField
              aria-label="Member"
              value={row.member}
              onChange={(v) => onChange({ member: v })}
              options={options.members.map((m) => ({ id: m, label: m }))}
              allowEmpty="Household"
              size="sm"
              className="col-span-2"
            />
          ) : null
        ) : options.members.length ? (
          <SelectField
            aria-label="Member"
            value={row.member}
            onChange={(v) => onChange({ member: v })}
            options={options.members.map((m) => ({ id: m, label: m }))}
            allowEmpty="Household"
            size="sm"
            className="col-span-2"
          />
        ) : null}
      </div>
      {issue || row.duplicate ? (
        <div className="flex flex-wrap items-center gap-2">
          {issue ? <span className="text-body-2-medium text-text-error-primary">{issue}</span> : null}
          {row.duplicate ? (
            // Wraps on narrow screens, unlike a Chip.
            <p className={cx("flex items-start gap-1 rounded-md px-1.5 py-0.5 text-body-2-medium", CHIP_COLORS.yellow)}>
              <RiErrorWarningLine className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              <span>
                Looks already recorded: {shortDateClient(row.duplicate.date)} · {row.duplicate.description || money(row.amount)}
                {row.duplicate.bookName ? ` · ${row.duplicate.bookName}` : ""}
              </span>
            </p>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
