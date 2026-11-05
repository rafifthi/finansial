"use client";

import { useState } from "react";
import { RiArrowRightLine, RiFlagLine } from "@remixicon/react";
import { mergeGoals } from "@/actions/savings";
import { Chip } from "@/components/base/badges/chip";
import { Button } from "@/components/base/buttons/button";
import { AlertDialog } from "@/components/base/modal/modal";
import { toast } from "@/components/base/toast/toast";
import { useBookId } from "./permissions";

export interface GoalMergeRow {
  goalId: string;
  goal: string;
  pot: string;
  isNew: boolean;
  target: string;
  /** e.g. "by Nov 2026"; "" without a date. */
  by: string;
  /** Set when the goal's "already saved" becomes the pot's starting balance. */
  startingBalance: string;
  notes: string[];
}

/** One-time move of the old Goals onto their savings pots, previewed before anything is written. */
export function MergeGoals({ rows }: { rows: GoalMergeRow[] }) {
  const bookId = useBookId();
  const [confirm, setConfirm] = useState(false);

  const merge = async () => {
    const res = await mergeGoals(bookId, {});
    if (!res.ok) {
      toast("Couldn't move the goals", { status: "error", description: res.error });
      throw new Error(res.error);
    }
    toast(`Moved ${rows.length} ${rows.length === 1 ? "goal" : "goals"} into savings pots`, { status: "success" });
  };

  return (
    <section className="flex flex-col gap-3 rounded-3xl border border-border-button-default bg-background-primary-default p-4 sm:p-5">
      <AlertDialog
        isOpen={confirm}
        onOpenChange={setConfirm}
        variant="default"
        icon={RiFlagLine}
        title={`Move ${rows.length} ${rows.length === 1 ? "goal" : "goals"} into savings pots?`}
        description="Targets, dates and already-saved amounts are written onto the pots in your sheet. The Goals tab is left as it is."
        confirmLabel="Move goals"
        pendingLabel="Moving…"
        onConfirm={merge}
      />
      <div className="flex flex-col gap-0.5">
        <h2 className="text-headline-semibold text-text-primary">Goals are now savings targets</h2>
        <p className="text-body-2-regular text-text-tertiary">
          Each goal moves onto its savings pot as that pot&apos;s target. Check where each one lands, then move them.
        </p>
      </div>
      <ul className="flex flex-col divide-y divide-separator-border rounded-2xl border border-border-button-default">
        {rows.map((r) => (
          <li key={r.goalId} className="flex flex-col gap-1 px-3 py-2.5">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <span className="flex min-w-0 items-center gap-1.5 text-body-medium text-text-primary">
                <span className="truncate">{r.goal}</span>
                <RiArrowRightLine className="size-3.5 shrink-0 text-foreground-icon-tertiary rtl:rotate-180" aria-label="to" />
                <span className="truncate">{r.pot}</span>
                {r.isNew ? (
                  <Chip color="yellow" variant="caption">
                    New pot
                  </Chip>
                ) : null}
              </span>
              <span className="text-body-2-medium text-text-primary tabular-nums">
                Target {r.target}
                {r.by ? ` ${r.by}` : ""}
              </span>
            </div>
            {r.startingBalance ? <span className="text-body-2-regular text-text-secondary tabular-nums">Starting balance set to {r.startingBalance}</span> : null}
            {r.notes.map((n) => (
              <span key={n} className="text-body-2-regular text-text-tertiary">
                {n}
              </span>
            ))}
          </li>
        ))}
      </ul>
      <Button variant="primary" leadingIcon={RiFlagLine} onClick={() => setConfirm(true)} className="self-end">
        Move {rows.length} {rows.length === 1 ? "goal" : "goals"}
      </Button>
    </section>
  );
}
