"use client";

import { useEffect, useState, useTransition } from "react";
import { RiRefreshLine } from "@remixicon/react";
import { applyReferenceSync, previewReferenceSync, type ReferenceSyncPreview } from "@/actions/sync";
import { Chip } from "@/components/base/badges/chip";
import { Button } from "@/components/base/buttons/button";
import { Checkbox } from "@/components/base/checkbox/checkbox";
import { Input } from "@/components/base/input/input";
import { toast } from "@/components/base/toast/toast";
import type { FormOptions } from "@/lib/data/app-data";
import { formatMoney } from "@/lib/finance/money";
import { cx } from "@/utils/cx";
import { shortDateClient } from "./format";
import { DrawerForm, FormDrawer } from "./form-drawer";
import { useBookId, useCan } from "./permissions";

/**
 * Pulls transactions added to the old "Money Management" sheet since the
 * migration. Shows what's new first; nothing is written until the user picks rows.
 */
export function ReferenceSyncButton({ linked, suggested, options }: { linked: boolean; suggested: string; options: FormOptions }) {
  const [open, setOpen] = useState(false);
  if (!useCan("data:write")) return null;
  return (
    <>
      <Button variant="secondary" leadingIcon={RiRefreshLine} onClick={() => setOpen(true)}>
        Sync old sheet
      </Button>
      <FormDrawer isOpen={open} onOpenChange={setOpen} aria-label="Sync from the old sheet" size="lg">
        <SyncForm linked={linked} suggested={suggested} options={options} onDone={() => setOpen(false)} />
      </FormDrawer>
    </>
  );
}

function SyncForm({ linked, suggested, options, onDone }: { linked: boolean; suggested: string; options: FormOptions; onDone: () => void }) {
  const bookId = useBookId();
  const money = (n: number) => formatMoney(n, options.money);
  // A linked book syncs from its own sheet; otherwise (or after "Change sheet") the user pastes one.
  const [asking, setAsking] = useState(!linked);
  const [link, setLink] = useState(linked ? "" : suggested);
  const [preview, setPreview] = useState<ReferenceSyncPreview | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [reading, startReading] = useTransition();
  const [saving, startSaving] = useTransition();

  const load = (input: string) => async () => {
    const res = await previewReferenceSync(bookId, { input });
    if (!res.ok || !res.data) return setError(res.ok ? "Couldn't read the sheet." : res.error);
    setError(null);
    setPreview(res.data);
    setAsking(false);
    // Likely duplicates start unticked; rows without a category can't be added.
    setPicked(new Set(res.data.candidates.filter((c) => !c.duplicateOf && !c.problem).map((c) => c.id)));
  };

  // A linked book reads its sheet as soon as the drawer opens.
  useEffect(() => {
    if (linked) startReading(load(""));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addable = preview?.candidates.filter((c) => !c.problem) ?? [];
  const toggle = (id: string, on: boolean) =>
    setPicked((p) => {
      const next = new Set(p);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  function submit() {
    if (asking) return startReading(load(link));
    if (!picked.size) return;
    setError(null);
    startSaving(async () => {
      const res = await applyReferenceSync(bookId, { input: link, ids: [...picked] });
      if (!res.ok) return setError(res.error);
      const { added = 0, categories = 0 } = res.data ?? {};
      toast(`Added ${added} ${added === 1 ? "transaction" : "transactions"}${categories ? ` and ${categories} new ${categories === 1 ? "category" : "categories"}` : ""} from the old sheet`, {
        status: "success",
      });
      onDone();
    });
  }

  return (
    <DrawerForm
      title="Sync from the old sheet"
      description={
        asking
          ? "Paste the link of the tracker you migrated from. It's only read, never changed."
          : "Transactions added to the old tracker that aren't here yet. Rows already pulled in are skipped, even if you edited them here."
      }
      onSubmit={submit}
      error={error}
      footer={
        asking ? (
          <Button type="submit" variant="primary" disabled={reading || !link.trim()}>
            {reading ? "Reading the sheet…" : "Check for new transactions"}
          </Button>
        ) : (
          <Button type="submit" variant="primary" disabled={saving || reading || picked.size === 0}>
            {saving ? "Adding…" : picked.size ? `Add ${picked.size} ${picked.size === 1 ? "transaction" : "transactions"}` : "Add transactions"}
          </Button>
        )
      }
    >
      {asking ? (
        <Input label="Old sheet link" value={link} onChange={setLink} placeholder="https://docs.google.com/spreadsheets/d/…" autoFocus />
      ) : reading && !preview ? (
        <p className="text-body-regular text-text-secondary">Reading the old sheet…</p>
      ) : preview ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-body-2-regular text-text-secondary">
              {preview.title ? `${preview.title} · ` : ""}
              {preview.candidates.length} new · {preview.alreadyThere} already here
            </p>
            <div className="flex items-center gap-1">
              {addable.length ? (
                <Button
                  type="button"
                  size="small"
                  variant="ghost"
                  onClick={() => setPicked(picked.size === addable.length ? new Set() : new Set(addable.map((c) => c.id)))}
                >
                  {picked.size === addable.length ? "Select none" : "Select all"}
                </Button>
              ) : null}
              <Button
                type="button"
                size="small"
                variant="ghost"
                onClick={() => {
                  setPreview(null);
                  setAsking(true);
                }}
              >
                Change sheet
              </Button>
            </div>
          </div>
          {preview.candidates.length === 0 ? (
            <p className="rounded-3xl border border-dashed border-border-button-default px-4 py-10 text-center text-body-medium text-text-secondary">
              You’re up to date. Nothing new in the old sheet.
            </p>
          ) : (
            <ul className="divide-y divide-separator-border overflow-hidden rounded-3xl border border-border-button-default">
              {preview.candidates.map((c) => (
                <li key={c.id}>
                  <Checkbox
                    isSelected={picked.has(c.id)}
                    onChange={(on) => toggle(c.id, on)}
                    isDisabled={Boolean(c.problem)}
                    aria-label={`${c.description}, ${money(c.amount)}`}
                    className="w-full gap-3 px-4 py-3 [&>span:last-child]:min-w-0 [&>span:last-child]:flex-1"
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="w-14 shrink-0 text-body-2-regular text-text-tertiary tabular-nums">{shortDateClient(c.date)}</span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className={cx("truncate text-body-medium", c.problem ? "text-text-tertiary" : "text-text-primary")}>{c.description || "Untitled"}</span>
                        <span className="truncate text-body-2-regular text-text-tertiary">
                          {c.problem ?? (c.duplicateOf ? `Maybe already here as “${c.duplicateOf}”` : c.categoryName)}
                        </span>
                      </span>
                      {c.duplicateOf && !c.problem ? (
                        <Chip variant="caption" color="yellow" className="shrink-0">
                          Duplicate?
                        </Chip>
                      ) : null}
                      <span className={cx("shrink-0 text-body-semibold tabular-nums", c.type === "income" ? "text-status-lime-text" : "text-text-primary")}>
                        {c.type === "income" ? "+" : ""}
                        {money(c.amount)}
                      </span>
                    </span>
                  </Checkbox>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : null}
    </DrawerForm>
  );
}
