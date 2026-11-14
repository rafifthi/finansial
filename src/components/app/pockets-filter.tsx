"use client";

import { useState, type ReactNode } from "react";
import { PillTab, PillTabList } from "@/components/base/tabs/pill-tab";

export type PocketsShow = "all" | "spending" | "savings";

export const POCKETS_SHOW: { id: PocketsShow; label: string }[] = [
  { id: "all", label: "All" },
  { id: "spending", label: "Needs & Wants" },
  { id: "savings", label: "Savings" },
];

/**
 * Filter on the Pockets page. Both groups render on the server; switching only
 * shows or hides them, so it's instant. The choice lives in `?show=` (swapped
 * in place, no round trip) so a reload or a shared link keeps it.
 */
export function PocketsFilter({
  initial,
  counts,
  savings,
  spending,
}: {
  initial: PocketsShow;
  counts: Record<PocketsShow, number>;
  savings: ReactNode;
  spending: ReactNode;
}) {
  const [show, setShow] = useState(initial);
  const select = (next: PocketsShow) => {
    setShow(next);
    const q = new URLSearchParams(window.location.search);
    if (next === "all") q.delete("show");
    else q.set("show", next);
    const query = q.toString();
    window.history.replaceState(null, "", query ? `?${query}` : window.location.pathname);
  };

  return (
    <>
      <PillTabList role="group" aria-label="Show pockets" className="self-start">
        {POCKETS_SHOW.map((t) => (
          <PillTab key={t.id} variant="gray" isSelected={show === t.id} onSelect={() => select(t.id)}>
            {t.label}
            <span className="ms-1 text-text-tertiary tabular-nums">{counts[t.id]}</span>
          </PillTab>
        ))}
      </PillTabList>
      {show !== "spending" ? savings : null}
      {show !== "savings" ? spending : null}
    </>
  );
}
