"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState, useTransition, type ReactNode } from "react";
import { Switch as AriaSwitch } from "react-aria-components";
import {
  RiArrowRightSLine,
  RiLogoutBoxRLine,
  RiMailLine,
  RiMoonLine,
} from "@remixicon/react";
import { applyThemeWithTransition, useThemeMode } from "@/components/application/theme/theme-toggle";
import { Avatar } from "@/components/base/avatar/avatar";
import { Badge } from "@/components/base/badges/badge";
import { SearchField } from "@/components/base/search-field/search-field";
import { SwitchTrack } from "@/components/base/switch/switch";
import { ROLE_INFO } from "@/lib/auth/roles";
import { cx } from "@/utils/cx";
import { accountHref, groupNav, navFor, type ResolvedNav } from "./app-sidebar";
import { BookIcon } from "./book-switcher";
import { PageHeader } from "./page-header";
import { useShell } from "./shell-context";

/** Pages the phone tab bar already shows, so More leaves them out. */
const IN_TAB_BAR = ["", "/transactions", "/budget"];

const chevron = <RiArrowRightSLine className="size-5 shrink-0 text-foreground-icon-tertiary rtl:-scale-x-100" aria-hidden />;

const rowClass = cx(
  "group flex min-h-12 w-full cursor-pointer items-center gap-3 ps-4 text-start outline-none transition-colors",
  "hover:bg-background-secondary-hover active:bg-background-secondary-hover focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-border-focus-ring",
);

/** Label + trailing bits, with an inset hairline under every row but the last. */
function RowBody({ label, trailing, tone = "default" }: { label: ReactNode; trailing?: ReactNode; tone?: "default" | "danger" }) {
  return (
    <span className="flex min-h-12 min-w-0 flex-1 items-center justify-between gap-3 border-b border-separator-border pe-3 group-last:border-b-0">
      <span className={cx("truncate text-body-medium", tone === "danger" ? "text-text-error-primary" : "text-text-primary")}>{label}</span>
      <span className="flex shrink-0 items-center gap-2">{trailing}</span>
    </span>
  );
}

function Group({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      {label ? <h2 className="px-1 text-caption-1-semibold uppercase text-text-tertiary">{label}</h2> : null}
      <div className="flex flex-col overflow-hidden rounded-3xl border border-separator-border bg-background-primary-default">{children}</div>
    </section>
  );
}

function NavRow({ item, active }: { item: ResolvedNav; active: boolean }) {
  return (
    <Link href={item.href} aria-current={active ? "page" : undefined} className={rowClass}>
      <item.icon className="size-5 shrink-0 text-foreground-icon-secondary" aria-hidden />
      <RowBody
        label={item.label}
        trailing={
          <>
            {item.badge ? <Badge color="neutral">{item.badge}</Badge> : null}
            {chevron}
          </>
        }
      />
    </Link>
  );
}

function DarkModeRow() {
  const dark = useThemeMode() === "dark";
  const ref = useRef<HTMLLabelElement | null>(null);
  return (
    <AriaSwitch
      ref={ref}
      isSelected={dark}
      // The reveal grows from the switch itself.
      onChange={(on) => void applyThemeWithTransition(on ? "dark" : "light", { element: ref.current?.querySelector("[aria-hidden]") as HTMLElement | null })}
      className={({ isFocusVisible }) => cx(rowClass, isFocusVisible && "ring-2 ring-inset ring-border-focus-ring")}
    >
      {(state) => (
        <>
          <RiMoonLine className="size-5 shrink-0 text-foreground-icon-secondary" aria-hidden />
          <RowBody label="Dark mode" trailing={<SwitchTrack state={state} size="sm" shape="pill" />} />
        </>
      )}
    </AriaSwitch>
  );
}

function SignOutRow({ action }: { action: () => Promise<void> }) {
  const [pending, start] = useTransition();
  return (
    <button type="button" onClick={() => start(() => action())} disabled={pending} className={cx(rowClass, "disabled:cursor-default")}>
      <RiLogoutBoxRLine className="size-5 shrink-0 text-foreground-icon-error" aria-hidden />
      <RowBody label={pending ? "Signing out…" : "Sign out"} tone="danger" />
    </button>
  );
}

/**
 * The phone's More tab as a full page: who you are, which book you're in,
 * every page the tab bar has no room for, then preferences and sign out.
 */
export function MoreScreen() {
  const shell = useShell();
  const { user, current, books } = shell;
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const nav = navFor(shell);
  const initials = (user.name || user.email).slice(0, 1).toUpperCase();
  const active = (item: ResolvedNav) => pathname === item.href || pathname.startsWith(`${item.href}/`);

  const base = current ? `/b/${current.id}` : "";
  // Same purpose groups as the sidebar, minus what the tab bar already shows.
  const groups = groupNav(nav.filter((n) => !current || !IN_TAB_BAR.some((p) => n.href === `${base}${p}`)));

  const q = query.trim().toLowerCase();
  const matches = q ? nav.filter((n) => n.label.toLowerCase().includes(q)) : [];

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-5">
      <PageHeader title="More" description="Pages, preferences and your account" />

      <SearchField aria-label="Search pages" placeholder="Search" value={query} onChange={setQuery} />

      {q ? (
        matches.length ? (
          <Group>
            {matches.map((item) => (
              <NavRow key={item.href} item={item} active={active(item)} />
            ))}
          </Group>
        ) : (
          <p className="py-6 text-center text-body-2-regular text-text-tertiary">No page matches “{query.trim()}”.</p>
        )
      ) : (
        <>
          <Group>
            <Link href={accountHref(current)} className={rowClass}>
              <Avatar size="lg" initials={initials} />
              <span className="flex min-h-16 min-w-0 flex-1 items-center justify-between gap-3 border-b border-separator-border pe-3 group-last:border-b-0">
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate text-headline-semibold text-text-primary">{user.name}</span>
                  <span className="flex min-w-0 items-center gap-1 text-body-2-regular text-text-tertiary">
                    <RiMailLine className="size-3.5 shrink-0 text-foreground-icon-tertiary" aria-hidden />
                    <bdi dir="ltr" className="truncate">
                      {user.email}
                    </bdi>
                  </span>
                </span>
                {chevron}
              </span>
            </Link>
            {current ? (
              <Link href="/books" className={rowClass}>
                <BookIcon kind={current.kind} className="size-9" />
                <RowBody
                  label={current.name}
                  trailing={
                    <>
                      <span className="text-body-2-regular text-text-tertiary">{books.length > 1 ? "Switch" : ROLE_INFO[current.role].label}</span>
                      {chevron}
                    </>
                  }
                />
              </Link>
            ) : null}
          </Group>

          {groups.map((g) => (
            <Group key={g.label} label={g.label}>
              {g.items.map((item) => (
                <NavRow key={item.href} item={item} active={active(item)} />
              ))}
            </Group>
          ))}

          <Group label="Preferences">
            <DarkModeRow />
          </Group>

          <Group>
            <SignOutRow action={shell.signOutAction} />
          </Group>
        </>
      )}
    </div>
  );
}
