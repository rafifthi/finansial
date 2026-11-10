"use client";

import { RiErrorWarningLine } from "@remixicon/react";
import type { BlockConflict } from "@/actions/library";
import { Avatar } from "@/components/base/avatar/avatar";
import { Button } from "@/components/base/buttons/button";
import { editorsOf } from "@/lib/library/presence";
import { quoteOf } from "@/lib/library/comments";
import { useLibrary } from "./library-context";

/** "Kanza is editing": the other people typing in this page in the last minute and a half. */
export function EditingNow({ cell }: { cell: string }) {
  const { userId, nameOf } = useLibrary();
  const others = editorsOf(cell).filter((e) => e.userId !== userId);
  if (!others.length) return null;
  const names = others.map((e) => nameOf(e.userId));
  return (
    <span role="status" className="flex items-center gap-1.5 text-body-2-regular text-text-secondary">
      <span className="flex -space-x-1.5">
        {names.map((n) => (
          <Avatar key={n} size="xs" initials={n.slice(0, 1).toUpperCase()} className="ring-2 ring-background-full" />
        ))}
      </span>
      <span className="max-sm:sr-only">
        {names.join(" and ")} {names.length === 1 ? "is" : "are"} editing
      </span>
      <span className="relative flex size-1.5" aria-hidden>
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent-solid opacity-60 motion-reduce:animate-none" />
        <span className="relative inline-flex size-1.5 rounded-full bg-accent-solid" />
      </span>
    </span>
  );
}

/**
 * Blocks both people reworded at once. Their version is what's saved; each
 * one asks which to keep. "Keep mine" writes this person's over it.
 */
export function ConflictBanner({
  conflicts,
  mineOf,
  onShow,
  onResolve,
}: {
  conflicts: BlockConflict[];
  mineOf: (id: string) => string;
  onShow: (id: string) => void;
  onResolve: (id: string, choice: "mine" | "theirs") => void;
}) {
  const { nameOf } = useLibrary();
  if (!conflicts.length) return null;
  return (
    <section aria-label="Changed by someone else while you were editing" className="flex flex-col gap-3 rounded-3xl border border-separator-border bg-background-primary-default p-3">
      {conflicts.map((c) => {
        const who = nameOf(c.theirs.by);
        const removed = c.kind === "removed";
        return (
          <div key={c.id} className="flex flex-col gap-2">
            <button type="button" onClick={() => onShow(c.id)} className="flex cursor-pointer items-start gap-2 rounded-md text-start outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring">
              <RiErrorWarningLine className="mt-0.5 size-4 shrink-0 text-chip-overdue-foreground" aria-hidden />
              <span className="text-body-medium text-text-primary">
                {removed ? `${who} changed a paragraph you deleted.` : `${who} changed this paragraph while you were editing it.`} Which should stay?
              </span>
            </button>
            <dl className="grid gap-2 ps-6 sm:grid-cols-2">
              <div className="flex flex-col gap-0.5 rounded-xl bg-background-secondary-default p-2">
                <dt className="text-caption-1-semibold text-text-tertiary">{who}’s</dt>
                <dd className="line-clamp-4 text-body-2-regular text-text-primary">{quoteOf(c.theirs.text) || "(empty)"}</dd>
              </div>
              <div className="flex flex-col gap-0.5 rounded-xl bg-background-secondary-default p-2">
                <dt className="text-caption-1-semibold text-text-tertiary">Yours</dt>
                <dd className="line-clamp-4 text-body-2-regular text-text-primary">{removed ? "(deleted)" : quoteOf(mineOf(c.id)) || "(empty)"}</dd>
              </div>
            </dl>
            <div className="flex flex-wrap gap-2 ps-6">
              <Button size="small" variant="secondary" onClick={() => onResolve(c.id, "theirs")}>
                {removed ? `Bring back ${who}’s` : `Use ${who}’s`}
              </Button>
              <Button size="small" variant="secondary" onClick={() => onResolve(c.id, "mine")}>
                {removed ? "Keep it deleted" : "Keep mine"}
              </Button>
            </div>
          </div>
        );
      })}
    </section>
  );
}
