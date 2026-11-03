"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { RiAddLine, RiArrowDownSLine, RiBookShelfLine, RiCheckLine, RiHome4Line, RiLock2Line } from "@remixicon/react";
import { Chip } from "@/components/base/badges/chip";
import { Dropdown, DropdownDivider, DropdownGroup, DropdownItem, DropdownPopover, DropdownTrigger } from "@/components/base/dropdown/dropdown";
import type { Role } from "@/lib/auth/roles";
import { cx } from "@/utils/cx";

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
        "flex size-8 shrink-0 items-center justify-center rounded-xl bg-linear-to-b text-white",
        kind === "personal" ? "from-purple-500 to-purple-600" : "from-accent-500 to-accent-600",
        className,
      )}
    >
      <Icon className="size-4" aria-hidden />
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
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const go = (href: string) => {
    setOpen(false);
    onNavigate?.();
    router.push(href);
  };

  return (
    <Dropdown isOpen={open} onOpenChange={setOpen}>
      <DropdownTrigger
        aria-label={current ? `Book: ${current.name}. Switch book` : "Choose a book"}
        className={cx(
          "flex w-full min-w-0 items-center gap-2 rounded-2xl text-start transition-colors hover:bg-background-secondary-hover",
          compact ? "p-1" : "p-1.5",
        )}
      >
        {current ? <BookIcon kind={current.kind} className={compact ? "size-7" : undefined} /> : (
          <span className="flex size-8 items-center justify-center rounded-xl bg-linear-to-b from-accent-500 to-accent-600 text-headline-semibold text-white">F</span>
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
      </DropdownTrigger>
      <DropdownPopover aria-label="Books" className="w-[280px]">
        <DropdownGroup label="Your books">
          {books.length === 0 ? <p className="px-2 py-1.5 text-body-2-regular text-text-tertiary">No books yet.</p> : null}
          {books.map((b) => (
            <DropdownItem key={b.id} selected={b.id === current?.id} onSelect={() => go(b.provisioning ? `/books/new?resume=${b.id}` : `/b/${b.id}`)}>
              <span className="flex w-full min-w-0 items-center gap-2">
                <BookIcon kind={b.kind} className="size-7" />
                <span className="min-w-0 flex-1 truncate text-body-medium text-text-primary">{b.name}</span>
                {b.provisioning ? (
                  <Chip variant="caption" color="yellow">Setup</Chip>
                ) : (
                  <Chip variant="caption" color={b.kind === "personal" ? "purple" : "blue"}>
                    {KIND_LABEL[b.kind]}
                  </Chip>
                )}
                {b.id === current?.id ? <RiCheckLine className="size-4 text-accent-600" aria-label="Current" /> : null}
              </span>
            </DropdownItem>
          ))}
        </DropdownGroup>
        <DropdownDivider />
        <DropdownItem onSelect={() => go("/books/new")}>
          <span className="flex items-center gap-2 text-body-medium text-text-primary">
            <RiAddLine className="size-5 text-foreground-icon-secondary" aria-hidden />
            New book
          </span>
        </DropdownItem>
        <DropdownItem onSelect={() => go("/books")}>
          <span className="flex items-center gap-2 text-body-medium text-text-primary">
            <RiBookShelfLine className="size-5 text-foreground-icon-secondary" aria-hidden />
            All books
          </span>
        </DropdownItem>
      </DropdownPopover>
    </Dropdown>
  );
}
