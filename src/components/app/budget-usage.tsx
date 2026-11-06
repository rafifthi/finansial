"use client";

import { useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { RiDraggable } from "@remixicon/react";
import { Button as AriaButton, DropIndicator, GridList, GridListItem, useDragAndDrop } from "react-aria-components";
import { reorderCategories } from "@/actions/entities";
import { Button } from "@/components/base/buttons/button";
import { toast } from "@/components/base/toast/toast";
import type { MoneyFormat } from "@/lib/finance/money";
import { cx } from "@/utils/cx";
import { BudgetBar } from "./budget-bar";
import { CategoryIcon } from "./category-icon";
import { useBookId } from "./permissions";

export interface UsageLine {
  id: string;
  name: string;
  emoji: string;
  color: string;
  group: string;
  actual: number;
  spent: number;
  toSavings: number;
  budget: number;
}

/**
 * The dashboard's Budget usage card, in the book's category order. Admins can
 * switch it to a reorder list (drag, or Enter on a handle then the arrow keys);
 * saving writes that order back to the categories, so Settings follows it too.
 */
export function BudgetUsage({
  lines,
  money,
  description,
  href,
  canReorder,
  empty,
}: {
  lines: UsageLine[];
  money: MoneyFormat;
  description: string;
  href: string;
  canReorder: boolean;
  empty: ReactNode;
}) {
  const bookId = useBookId();
  const [editing, setEditing] = useState(false);
  const [order, setOrder] = useState<string[]>(() => lines.map((l) => l.id));
  const [pending, startTransition] = useTransition();
  const byId = new Map(lines.map((l) => [l.id, l]));
  // Fresh data from the server (e.g. a new category) shows up when not mid-edit.
  const shown = editing ? order.map((id) => byId.get(id)).filter((l): l is UsageLine => Boolean(l)) : lines;

  const { dragAndDropHooks } = useDragAndDrop({
    getItems: (keys) => [...keys].map((key) => ({ "text/plain": byId.get(String(key))?.name ?? String(key) })),
    onReorder(e) {
      setOrder((current) => {
        const moving = current.filter((id) => e.keys.has(id));
        const rest = current.filter((id) => !e.keys.has(id));
        const at = rest.indexOf(String(e.target.key));
        rest.splice(e.target.dropPosition === "before" ? at : at + 1, 0, ...moving);
        return rest;
      });
    },
    renderDropIndicator: (target) => (
      <DropIndicator target={target} className={({ isDropTarget }) => cx("-my-px h-0.5 rounded-full", isDropTarget ? "bg-button-ghost-foreground" : "bg-transparent")} />
    ),
  });

  const start = () => {
    setOrder(lines.map((l) => l.id));
    setEditing(true);
  };
  const save = () =>
    startTransition(async () => {
      const res = await reorderCategories(bookId, { ids: order });
      if (!res.ok) return void toast("Couldn't save the order", { status: "error", description: res.error });
      toast("Order saved", { status: "success", description: "Settings and Budget follow it too." });
      setEditing(false);
    });

  return (
    <section className="flex min-w-0 flex-col gap-4 rounded-3xl border border-separator-border bg-background-primary-default p-3 sm:p-4 xl:col-span-2">
      <header className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 className="text-headline-semibold text-text-primary">Budget usage</h2>
          <p className="text-body-2-regular text-text-tertiary">{editing ? "Drag to reorder, or press Enter on a handle and use the arrow keys" : description}</p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {editing ? (
            <>
              <Button variant="ghost" size="small" onClick={() => setEditing(false)} disabled={pending}>
                Cancel
              </Button>
              <Button variant="primary" size="small" onClick={save} disabled={pending}>
                {pending ? "Saving…" : "Save order"}
              </Button>
            </>
          ) : (
            <>
              {canReorder && lines.length > 1 ? (
                <button
                  type="button"
                  onClick={start}
                  className="rounded-md text-body-2-medium text-text-secondary outline-none hover:text-text-primary focus-visible:ring-2 focus-visible:ring-border-focus-ring"
                >
                  Reorder
                </button>
              ) : null}
              <Link
                href={href}
                className="rounded-md text-body-2-medium text-button-ghost-foreground outline-none hover:underline focus-visible:ring-2 focus-visible:ring-border-focus-ring"
              >
                View all
              </Link>
            </>
          )}
        </div>
      </header>

      {lines.length === 0 ? (
        empty
      ) : editing ? (
        <GridList
          aria-label="Budget lines, in order"
          items={shown}
          dragAndDropHooks={dragAndDropHooks}
          className="flex flex-col gap-1 outline-none"
        >
          {(l) => (
            <GridListItem
              id={l.id}
              textValue={l.name}
              className={({ isDragging, isFocusVisible }) =>
                cx(
                  "flex items-center gap-3 rounded-xl border border-border-button-default bg-background-primary-default px-2 py-1.5 outline-none",
                  isDragging && "opacity-50",
                  isFocusVisible && "ring-2 ring-border-focus-ring",
                )
              }
            >
              <AriaButton
                slot="drag"
                aria-label={`Move ${l.name}`}
                className="flex size-8 shrink-0 cursor-grab items-center justify-center rounded-lg text-foreground-icon-tertiary outline-none hover:bg-background-secondary-hover focus-visible:ring-2 focus-visible:ring-border-focus-ring active:cursor-grabbing max-sm:size-11"
              >
                <RiDraggable className="size-4" aria-hidden />
              </AriaButton>
              <CategoryIcon name={l.name} emoji={l.emoji} color={l.color} group={l.group} size="sm" />
              <span className="min-w-0 flex-1 truncate text-body-medium text-text-primary">{l.name}</span>
              <span className="shrink-0 text-caption-1-medium text-text-tertiary">{l.group}</span>
            </GridListItem>
          )}
        </GridList>
      ) : (
        <div className="grid gap-x-8 gap-y-5 md:grid-cols-2">
          {shown.map((l) => (
            <BudgetBar
              key={l.id}
              name={l.name}
              category={l}
              actual={l.actual}
              spent={l.spent}
              toSavings={l.toSavings}
              budget={l.budget}
              money={money}
            />
          ))}
        </div>
      )}
    </section>
  );
}
