"use client";

import { useRouter } from "next/navigation";
import { RiAddLine, RiArrowDownSLine, RiBookShelfLine, RiCheckLine, RiHome4Line, RiLock2Line } from "@remixicon/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Role } from "@/lib/auth/roles";
import { cx } from "@/utils/cx";
import { Logo } from "./logo";

export interface ShellBook {
  id: string;
  name: string;
  kind: "family" | "personal";
  role: Role;
  /** Still being set up in the wizard. */
  provisioning?: boolean;
}

export function BookIcon({ kind, className }: { kind: ShellBook["kind"]; className?: string }) {
  const Icon = kind === "personal" ? RiLock2Line : RiHome4Line;
  return (
    <span
      className={cx(
        "flex size-8 shrink-0 items-center justify-center rounded-xl",
        // One accent: the family book wears the green, a personal one stays neutral.
        kind === "personal" ? "bg-background-tertiary-default text-text-primary" : "bg-accent-solid text-on-accent",
        className,
      )}
    >
      <Icon className="size-4 text-current" aria-hidden />
    </span>
  );
}

export const KIND_LABEL = { family: "Family", personal: "Personal" } as const;

/** Current book + a menu to jump to another book, start a new one or see all. */
export function BookSwitcher({
  books,
  current,
  compact,
  onNavigate,
}: {
  books: ShellBook[];
  current?: ShellBook;
  /** Slim variant for the phone top bar. */
  compact?: boolean;
  onNavigate?: () => void;
}) {
  const router = useRouter();
  const go = (href: string) => {
    onNavigate?.();
    router.push(href);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={current ? `Book: ${current.name}. Switch book` : "Choose a book"}
        className={cx(
          "flex w-full min-w-0 cursor-pointer items-center gap-2 rounded-2xl text-start outline-none transition-colors hover:bg-background-secondary-hover focus-visible:ring-2 focus-visible:ring-border-focus-ring",
          compact ? "p-1" : "p-1.5",
        )}
      >
        {current ? <BookIcon kind={current.kind} className={compact ? "size-7" : undefined} /> : (
          <Logo />
        )}
        <span className="flex min-w-0 flex-1 flex-col">
          <span className={cx("truncate text-text-primary", compact ? "text-headline-semibold" : "text-body-semibold")}>
            {current?.name ?? "Finansial"}
          </span>
          {!compact ? (
            <span className="truncate text-caption-1-medium text-text-tertiary">
              {current ? `${KIND_LABEL[current.kind]} book` : `${books.length} book${books.length === 1 ? "" : "s"}`}
            </span>
          ) : null}
        </span>
        <RiArrowDownSLine className="size-5 shrink-0 text-foreground-icon-tertiary" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[280px]">
        <DropdownMenuLabel>Your books</DropdownMenuLabel>
        {books.length === 0 ? <p className="px-2 py-1.5 text-body-2-regular text-text-tertiary">No books yet.</p> : null}
        {books.map((b) => (
          <DropdownMenuItem
            key={b.id}
            onSelect={() => go(b.provisioning ? `/books/new?resume=${b.id}` : `/b/${b.id}`)}
            className={b.id === current?.id ? "bg-dropdown-item-hover-background" : undefined}
          >
            <BookIcon kind={b.kind} className="size-7" />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-body-medium text-text-primary">{b.name}</span>
              <span className="truncate text-caption-1-medium text-text-tertiary">
                {b.provisioning ? "Finish setup" : `${KIND_LABEL[b.kind]} book`}
              </span>
            </span>
            {b.id === current?.id ? <RiCheckLine className="size-4 text-button-ghost-foreground" aria-label="Current" /> : null}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => go("/books/new")}>
          <RiAddLine aria-hidden />
          New book
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => go("/books")}>
          <RiBookShelfLine aria-hidden />
          All books
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
