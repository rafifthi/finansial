"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  RiArrowLeftLine,
  RiArrowRightLine,
  RiCheckboxCircleFill,
  RiCloseCircleFill,
  RiExternalLinkLine,
  RiFileCopyLine,
  RiLoader4Line,
  RiRefreshLine,
  RiUserAddLine,
} from "@remixicon/react";
import { checkSheet, createBook, discardDraftBook, previewImport, resumeBook, type CreateBookResult, type ImportPreview } from "@/actions/books";
import { Chip } from "@/components/base/badges/chip";
import { Button, ButtonLink } from "@/components/base/buttons/button";
import { IconButton } from "@/components/base/buttons/icon-button";
import { Input } from "@/components/base/input/input";
import { RadioCard } from "@/components/base/radio/radio-card";
import { RadioGroup } from "@/components/base/radio/radio";
import { toast } from "@/components/base/toast/toast";
import { PROVISION_STEPS } from "@/lib/books/provision";
import type { SheetVerification } from "@/lib/books/verify";
import { formatMoney } from "@/lib/finance/money";
import { END_OF_MONTH } from "@/lib/finance/period";
import { cx } from "@/utils/cx";
import { SelectField } from "./fields";
import { monthLabelClient } from "./format";
import { CUTOFF_OPTIONS } from "./settings-form";

export interface ResumeInfo {
  id: string;
  name: string;
  kind: "family" | "personal";
  step: string;
  failed: boolean;
}

const STEPS = ["About", "Spreadsheet", "History", "Create"] as const;

/* ── Shared bits ───────────────────────────────────────────────────────────── */

function Panel({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-5 rounded-3xl border border-border-button-default bg-background-primary-default p-5 sm:p-6">
      <header className="flex flex-col gap-1">
        <h2 className="text-title-3-semibold text-text-primary">{title}</h2>
        {description ? <p className="text-body-regular text-text-secondary">{description}</p> : null}
      </header>
      {children}
    </section>
  );
}

function Checklist({ result, checking }: { result: SheetVerification | null; checking: boolean }) {
  if (!result && !checking) return null;
  return (
    <ul aria-live="polite" className="flex flex-col gap-2 rounded-2xl bg-background-secondary-default p-3">
      {checking && !result ? (
        <li className="flex items-center gap-2 text-body-medium text-text-secondary">
          <RiLoader4Line className="size-5 animate-spin text-foreground-icon-tertiary" aria-hidden />
          Checking the sheet…
        </li>
      ) : null}
      {result?.checks.map((c) => (
        <li key={c.id} className="flex items-start gap-2">
          {c.status === "pass" ? (
            <RiCheckboxCircleFill className="mt-0.5 size-5 shrink-0 text-status-lime-text" aria-label="Passed" />
          ) : (
            <RiCloseCircleFill className="mt-0.5 size-5 shrink-0 text-text-error-primary" aria-label="Failed" />
          )}
          <span className="flex min-w-0 flex-col">
            <span className={cx("text-body-medium", c.status === "pass" ? "text-text-primary" : "text-text-error-primary")}>{c.label}</span>
            {c.detail ? <span className="text-body-2-regular text-text-secondary">{c.detail}</span> : null}
          </span>
        </li>
      ))}
      {result?.ok && result.title ? <li className="ps-7 text-body-2-regular text-text-tertiary">“{result.title}”</li> : null}
    </ul>
  );
}

/** Re-checks a pasted link ~600ms after typing stops (and on demand). */
function useSheetCheck(input: string, purpose: "book" | "import", resumeBookId?: string) {
  const [result, setResult] = useState<SheetVerification | null>(null);
  const [checking, startTransition] = useTransition();
  const seq = useRef(0);
  const run = (value: string) => {
    const mine = ++seq.current;
    startTransition(async () => {
      const res = await checkSheet({ input: value, purpose, resumeBookId });
      if (mine !== seq.current) return; // a newer paste won
      setResult(res.ok ? res.data! : { ok: false, sheetId: null, checks: [{ id: "link", label: "Couldn't check", status: "fail", detail: res.error }] });
    });
  };
  useEffect(() => {
    if (!input.trim()) return;
    const t = setTimeout(() => run(input), 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-check only when the text changes
  }, [input]);
  return { result: input.trim() ? result : null, checking, recheck: () => run(input) };
}

function CopyRow({ value }: { value: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-xl border border-border-button-default bg-background-primary-default py-1.5 pe-1.5 ps-3">
      <code className="min-w-0 flex-1 truncate text-body-2-medium text-text-primary">{value}</code>
      <IconButton
        size="small"
        icon={RiFileCopyLine}
        aria-label="Copy the service account email"
        onClick={() => navigator.clipboard.writeText(value).then(() => toast("Copied", { status: "success" }))}
      />
    </div>
  );
}

/* ── Wizard ────────────────────────────────────────────────────────────────── */

export function NewBookWizard({
  serviceAccount,
  userEmail,
  demo,
  resume,
}: {
  serviceAccount: string;
  userEmail: string;
  demo: boolean;
  resume?: ResumeInfo;
}) {
  const router = useRouter();
  const [step, setStep] = useState(resume ? 3 : 0);
  const [name, setName] = useState(resume?.name ?? "");
  const [kind, setKind] = useState<"family" | "personal">(resume?.kind ?? "family");
  const [sheet, setSheet] = useState("");
  const [start, setStart] = useState<"fresh" | "import">("fresh");
  const [importSheet, setImportSheet] = useState("");
  const [cutoff, setCutoff] = useState(END_OF_MONTH);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [result, setResult] = useState<CreateBookResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();

  const target = useSheetCheck(sheet, "book");
  const source = useSheetCheck(importSheet, "import");

  // Preview the import as soon as the old sheet passes its checks.
  const sourceOk = start === "import" && source.result?.ok;
  useEffect(() => {
    if (!sourceOk) return;
    let live = true;
    previewImport({ input: importSheet }).then((res) => {
      if (!live) return;
      if (res.ok) {
        setPreview(res.data!);
        setPreviewError(null);
      } else setPreviewError(res.error);
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh when the verified sheet changes
  }, [sourceOk, source.result?.sheetId]);

  const canContinue = [
    name.trim().length > 0,
    Boolean(target.result?.ok),
    start === "fresh" || Boolean(source.result?.ok && preview),
    true,
  ][step];

  const create = () =>
    startTransition(async () => {
      setError(null);
      const res = resume
        ? await resumeBook({ bookId: resume.id })
        : await createBook({ name, kind, sheet, start, importSheet: start === "import" ? importSheet : undefined, cutoffDay: cutoff });
      if (!res.ok) return setError(res.error);
      setResult(res.data!);
      if (res.data!.provision.ok) router.refresh();
    });

  const retry = () =>
    startTransition(async () => {
      setError(null);
      const res = await resumeBook({ bookId: result?.bookId ?? resume!.id });
      if (!res.ok) return setError(res.error);
      setResult(res.data!);
      if (res.data!.provision.ok) router.refresh();
    });

  const discard = () =>
    startTransition(async () => {
      const res = await discardDraftBook({ bookId: resume!.id });
      if (!res.ok) return void toast("Couldn't discard", { status: "error", description: res.error });
      toast("Draft discarded", { status: "success" });
      router.push("/books");
      router.refresh();
    });

  const bookId = result?.bookId ?? resume?.id;
  const provision = result?.provision;

  /* Success */
  if (provision?.ok && bookId) {
    return (
      <section className="mx-auto flex w-full max-w-xl flex-col items-center gap-5 rounded-3xl border border-border-button-default bg-background-primary-default p-8 text-center">
        <RiCheckboxCircleFill className="size-12 text-status-lime-text" aria-hidden />
        <div className="flex flex-col gap-1">
          <h2 className="text-title-2-semibold text-text-primary">{name || resume?.name} is ready</h2>
          <p className="text-body-regular text-text-secondary">
            {provision.counts
              ? `${provision.counts.transactions ?? 0} transactions, ${provision.counts.categories ?? 0} categories and ${provision.counts.accounts ?? 0} accounts are in the sheet.`
              : "Everything is set up."}
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          {kind === "family" ? (
            <ButtonLink href={`/b/${bookId}/members`} variant="secondary" leadingIcon={RiUserAddLine}>
              Invite people
            </ButtonLink>
          ) : null}
          <ButtonLink href={`/b/${bookId}`} variant="primary" trailingIcon={RiArrowRightLine}>
            Open the book
          </ButtonLink>
        </div>
      </section>
    );
  }

  // Enter (or the phone keyboard's Go) runs the step's primary action.
  const primary = () => {
    if (step < 3) {
      if (canContinue) setStep((s) => s + 1);
    } else if (provision && !provision.ok) retry();
    else create();
  };

  return (
    <form
      noValidate
      className="mx-auto flex w-full max-w-2xl flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!busy) primary();
      }}
    >
      {!resume ? (
        <ol className="flex items-center gap-2" aria-label="Steps">
          {STEPS.map((label, i) => (
            <li key={label} className="flex min-w-0 flex-1 items-center gap-2">
              <span
                aria-current={i === step ? "step" : undefined}
                className={cx(
                  "flex size-7 shrink-0 items-center justify-center rounded-full text-caption-1-semibold",
                  i < step ? "bg-linear-to-b from-accent-600 to-accent-700 text-white" : i === step ? "border-2 border-accent-500 text-accent-600" : "border border-border-button-default text-text-tertiary",
                )}
              >
                {i < step ? "✓" : i + 1}
              </span>
              <span className={cx("hidden truncate text-body-2-medium sm:block", i === step ? "text-text-primary" : "text-text-tertiary")}>{label}</span>
              {i < STEPS.length - 1 ? <span className="h-px flex-1 bg-separator-border" aria-hidden /> : null}
            </li>
          ))}
        </ol>
      ) : null}

      {step === 0 ? (
        <Panel title="About the book" description="You can rename it later.">
          <Input label="Name" placeholder="e.g. Cutez Family" value={name} onChange={setName} isRequired autoFocus maxLength={60} />
          <RadioGroup aria-label="Who can see it" value={kind} onChange={(v) => setKind(v as "family" | "personal")} className="grid gap-3 sm:grid-cols-2">
            <RadioCard value="family" title="Family" description="Shared with people you invite" className="min-w-0" />
            <RadioCard value="personal" title="Personal" description="Private: only you, ever" className="min-w-0" />
          </RadioGroup>
        </Panel>
      ) : null}

      {step === 1 ? (
        <Panel title="Connect an empty Google Sheet" description="Each book lives in its own spreadsheet in your Google Drive.">
          <ol className="flex flex-col gap-4">
            <li className="flex gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-background-tertiary-default text-caption-1-semibold text-text-secondary">1</span>
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <span className="text-body-medium text-text-primary">Create a blank sheet{demo ? " (demo: skip)" : ""}</span>
                <a
                  href="https://sheets.new"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 self-start rounded-md text-body-2-medium text-button-ghost-foreground outline-none hover:underline focus-visible:ring-2 focus-visible:ring-border-focus-ring"
                >
                  Open sheets.new <RiExternalLinkLine className="size-4" aria-hidden />
                </a>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-background-tertiary-default text-caption-1-semibold text-text-secondary">2</span>
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <span className="text-body-medium text-text-primary">
                  Click <span className="text-text-primary">Share</span>, add this address as <span className="text-text-primary">Editor</span>
                </span>
                <CopyRow value={serviceAccount} />
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-background-tertiary-default text-caption-1-semibold text-text-secondary">3</span>
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <Input
                  label="Paste the sheet's link"
                  placeholder={demo ? "demo-empty-1 (try demo-viewer, demo-notyours, demo-hasdata, demo-private)" : "https://docs.google.com/spreadsheets/d/…"}
                  value={sheet}
                  onChange={setSheet}
                  inputDir="ltr"
                />
                <Checklist result={target.result} checking={target.checking} />
                {target.result && !target.result.ok ? (
                  <Button variant="secondary" size="small" leadingIcon={RiRefreshLine} onClick={target.recheck} disabled={target.checking} className="self-start">
                    Check again
                  </Button>
                ) : null}
              </div>
            </li>
          </ol>
          <p className="text-body-2-regular text-text-tertiary">
            Signed in as {userEmail}: the sheet must be owned by (or editable by) this Google account.
          </p>
        </Panel>
      ) : null}

      {step === 2 ? (
        <Panel title="Bring your history?" description="Optional. You can always add things by hand later.">
          <RadioGroup aria-label="Start" value={start} onChange={(v) => setStart(v as "fresh" | "import")} className="grid gap-3 sm:grid-cols-2">
            <RadioCard value="fresh" title="Start fresh" description="Starter categories you can edit" className="min-w-0" />
            <RadioCard value="import" title="Import my old sheet" description="Money Management V3 (read-only)" className="min-w-0" />
          </RadioGroup>
          {start === "import" ? (
            <div className="flex flex-col gap-3">
              <p className="text-body-regular text-text-secondary">
                Share the old sheet with the address above as <span className="text-text-primary">Viewer</span>, then paste its link.
              </p>
              <CopyRow value={serviceAccount} />
              <Input
                label="Old sheet's link"
                placeholder={demo ? "demo-old-sheet" : "https://docs.google.com/spreadsheets/d/…"}
                value={importSheet}
                onChange={setImportSheet}
                inputDir="ltr"
              />
              <Checklist result={source.result} checking={source.checking} />
              {previewError ? <p className="text-body-2-regular text-text-error-primary">{previewError}</p> : null}
              {preview && source.result?.ok ? <ImportPreviewCard preview={preview} /> : null}
            </div>
          ) : null}
          <div className="flex flex-col gap-1">
            <SelectField label="Cut-off day" value={String(cutoff)} onChange={(v) => setCutoff(Number(v) || END_OF_MONTH)} options={CUTOFF_OPTIONS} />
            <p className="text-body-2-regular text-text-tertiary">
              {start === "import" ? "Keep “End of month” to match your old sheet's monthly totals. " : ""}You can change it later in Settings → Book.
            </p>
          </div>
        </Panel>
      ) : null}

      {step === 3 ? (
        <Panel
          title={resume ? `Finish setting up ${resume.name}` : "Review and create"}
          description={resume ? "Setup stopped part-way. Retrying continues from where it stopped; nothing is added twice." : undefined}
        >
          {!resume ? (
            <dl className="grid gap-3 text-body-regular sm:grid-cols-2">
              <Summary label="Name" value={name} />
              <Summary label="Kind" value={kind === "family" ? "Family (shared)" : "Personal (only you)"} />
              <Summary label="Spreadsheet" value={target.result?.title ?? "—"} />
              <Summary label="Start" value={start === "fresh" ? "Starter categories" : `Import ${preview ? `${preview.counts.transactions} transactions` : ""}`} />
            </dl>
          ) : null}
          {busy || provision ? (
            <ol className="flex flex-col gap-2 rounded-2xl bg-background-secondary-default p-3">
              {PROVISION_STEPS.map((s) => {
                const isDone = provision?.completed.includes(s.id) || (resume && !provision && PROVISION_STEPS.findIndex((x) => x.id === resume.step) >= PROVISION_STEPS.findIndex((x) => x.id === s.id));
                const isFailed = provision?.failedStep === s.id;
                return (
                  <li key={s.id} className="flex items-center gap-2 text-body-medium">
                    {isDone ? (
                      <RiCheckboxCircleFill className="size-5 text-status-lime-text" aria-label="Done" />
                    ) : isFailed ? (
                      <RiCloseCircleFill className="size-5 text-text-error-primary" aria-label="Failed" />
                    ) : busy ? (
                      <RiLoader4Line className="size-5 animate-spin text-foreground-icon-tertiary" aria-label="Working" />
                    ) : (
                      <span className="size-5 rounded-full border border-border-button-default" aria-hidden />
                    )}
                    <span className={isFailed ? "text-text-error-primary" : "text-text-primary"}>{s.label}</span>
                  </li>
                );
              })}
              {provision?.error ? <li className="ps-7 text-body-2-regular text-text-error-primary">{provision.error}</li> : null}
            </ol>
          ) : null}
          {error ? (
            <p role="alert" className="text-body-2-regular text-text-error-primary">
              {error}
            </p>
          ) : null}
        </Panel>
      ) : null}

      <div className="flex items-center justify-between gap-2">
        {resume ? (
          <Button variant="ghost" onClick={discard} disabled={busy}>
            Discard draft
          </Button>
        ) : step > 0 && !provision ? (
          <Button variant="secondary" leadingIcon={RiArrowLeftLine} onClick={() => setStep((s) => s - 1)} disabled={busy}>
            Back
          </Button>
        ) : (
          <Link href="/books" className="rounded-md px-2 text-body-medium text-text-secondary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-border-focus-ring">
            Cancel
          </Link>
        )}
        {step < 3 ? (
          <Button type="submit" variant="primary" trailingIcon={RiArrowRightLine} disabled={!canContinue}>
            Continue
          </Button>
        ) : provision && !provision.ok ? (
          <Button type="submit" variant="primary" leadingIcon={RiRefreshLine} disabled={busy}>
            {busy ? "Retrying…" : `Retry from “${PROVISION_STEPS.find((s) => s.id === provision.failedStep)?.label}”`}
          </Button>
        ) : (
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? "Setting up…" : resume ? "Retry setup" : "Create book"}
          </Button>
        )}
      </div>
    </form>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col">
      <dt className="text-body-2-medium text-text-tertiary">{label}</dt>
      <dd className="truncate text-text-primary">{value}</dd>
    </div>
  );
}

function ImportPreviewCard({ preview }: { preview: ImportPreview }) {
  const money = (n: number) => formatMoney(n, { currency: "IDR", locale: "id-ID" });
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border-button-default p-4">
      <div className="flex flex-wrap gap-2">
        {Object.entries(preview.counts).map(([k, v]) => (
          <Chip key={k} color="neutral">
            {v} {k}
          </Chip>
        ))}
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-body-2-medium text-text-tertiary">Spending per month (compare with your old Report)</span>
        <ul className="grid grid-cols-2 gap-x-6 gap-y-1 text-body-2-regular sm:grid-cols-3">
          {preview.months.map((m) => (
            <li key={m.month} className="flex justify-between gap-2 tabular-nums">
              <span className="text-text-secondary">{monthLabelClient(m.month, "en-GB", "short")}</span>
              <span className="text-text-primary">{money(m.spent)}</span>
            </li>
          ))}
        </ul>
      </div>
      {preview.warnings.length ? (
        <ul className="flex flex-col gap-1 text-body-2-regular text-text-secondary">
          {preview.warnings.map((w) => (
            <li key={w}>⚠ {w}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
