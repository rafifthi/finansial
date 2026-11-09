"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { useId, useTransition } from "react";
import {
  type RemixiconComponentType,
  RiAddLine,
  RiArrowLeftRightLine,
  RiBankCard2Line,
  RiBookOpenLine,
  RiBookShelfLine,
  RiCalendarScheduleLine,
  RiCheckDoubleLine,
  RiExpandUpDownLine,
  RiGroupLine,
  RiHomeLine,
  RiListCheck3,
  RiLogoutBoxRLine,
  RiMoreLine,
  RiPieChartLine,
  RiSafe2Line,
  RiRepeatLine,
  RiSettings4Line,
  RiShieldUserLine,
  RiUserLine,
} from "@remixicon/react";
import { ThemeToggle } from "@/components/application/theme/theme-toggle";
import { Avatar } from "@/components/base/avatar/avatar";
import { Badge } from "@/components/base/badges/badge";
import { SpinnerGlyph } from "@/components/base/spinner/spinner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ROLE_INFO } from "@/lib/auth/roles";
import type { FormOptions } from "@/lib/data/app-data";
import { cx } from "@/utils/cx";
import { BookSwitcher, type ShellBook } from "./book-switcher";
import type { ShellValue } from "./shell-context";
import { useCan } from "./permissions";

/** What a page is for; the sidebar and the More page both group by it, in this order. */
export const NAV_GROUPS = [
  { key: "finance", label: "Finance" },
  { key: "others", label: "Others" },
  // Setting up the book rather than a purpose: the sidebar shows it without a heading.
  { key: "book", label: "Book" },
] as const;

export type NavGroup = (typeof NAV_GROUPS)[number]["key"];

interface NavEntry {
  path: string;
  label: string;
  icon: RemixiconComponentType;
  group: NavGroup;
  badgeKey?: "unverified";
  /** Shown only to book admins. */
  admins?: boolean;
}

/** In-book destinations; `path` is relative to /b/<bookId>. */
const BOOK_NAV: NavEntry[] = [
  { path: "", label: "Dashboard", icon: RiHomeLine, group: "finance" },
  { path: "/transactions", label: "Transactions", icon: RiArrowLeftRightLine, group: "finance" },
  { path: "/reconcile", label: "Reconcile", icon: RiCheckDoubleLine, group: "finance", badgeKey: "unverified" },
  { path: "/bill-check", label: "Bill check", icon: RiBankCard2Line, group: "finance" },
  { path: "/budget", label: "Budget", icon: RiPieChartLine, group: "finance" },
  { path: "/savings", label: "Savings", icon: RiSafe2Line, group: "finance" },
  { path: "/installments", label: "Installments", icon: RiCalendarScheduleLine, group: "finance" },
  { path: "/recurring", label: "Recurring", icon: RiRepeatLine, group: "finance" },
  { path: "/lists", label: "Lists", icon: RiListCheck3, group: "others" },
  { path: "/library", label: "Library", icon: RiBookOpenLine, group: "others" },
  { path: "/members", label: "Members", icon: RiGroupLine, group: "book", admins: true },
  { path: "/settings", label: "Settings", icon: RiSettings4Line, group: "book" },
];

type ShellProps = ShellValue;

export interface ResolvedNav {
  href: string;
  label: string;
  icon: RemixiconComponentType;
  badge?: number;
  exact?: boolean;
  /** In-book pages only; account pages aren't grouped. */
  group?: NavGroup;
}

export interface ResolvedNavGroup {
  key: NavGroup | "account";
  label: string;
  items: ResolvedNav[];
}

/** Nav entries in their purpose groups, empty groups dropped. Account pages form one group. */
export function groupNav(nav: ResolvedNav[]): ResolvedNavGroup[] {
  if (!nav.some((n) => n.group)) return [{ key: "account", label: "Account", items: nav }];
  return NAV_GROUPS.map((g) => ({ key: g.key, label: g.label, items: nav.filter((n) => n.group === g.key) })).filter((g) => g.items.length);
}

export function navFor({ current, user, badges }: Pick<ShellProps, "current" | "user" | "badges">): ResolvedNav[] {
  if (current) {
    return BOOK_NAV.filter((n) => !n.admins || current.role === "admin").map((n) => ({
      href: `/b/${current.id}${n.path}`,
      label: n.label,
      icon: n.icon,
      badge: n.badgeKey ? badges[n.badgeKey] : undefined,
      exact: n.path === "",
      group: n.group,
    }));
  }
  return [
    { href: "/books", label: "Your books", icon: RiBookShelfLine },
    { href: "/settings", label: "Settings", icon: RiSettings4Line },
    ...(user.isSystemAdmin ? [{ href: "/admin/users", label: "All users", icon: RiShieldUserLine }] : []),
  ];
}

/** Where the avatar goes: the Account tab of whichever Settings page applies. */
/** The phone's More page: everything the tab bar has no room for. */
export const moreHref = (current?: ShellBook) => (current ? `/b/${current.id}/more` : "/more");

export const accountHref = (current?: ShellBook) => (current ? `/b/${current.id}/settings?tab=account` : "/settings?tab=account");

const isActive = (pathname: string, item: ResolvedNav) =>
  item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);

function SidebarPanel({ onNavigate, ...props }: ShellProps & { onNavigate?: () => void }) {
  const { user, current, books, signOutAction } = props;
  const pathname = usePathname();
  const initials = (user.name || user.email).slice(0, 1).toUpperCase();
  const nav = navFor(props);
  const canCatat = useCan("data:write") && Boolean(current);
  const catatHref = current ? `/b/${current.id}/catat` : "";
  const onCatat = pathname === catatHref;
  const navId = useId();

  return (
    <div className="flex h-full flex-col justify-between gap-4">
      <div className="flex flex-col gap-3">
        <BookSwitcher books={books} current={current} onNavigate={onNavigate} />
        {canCatat ? (
          // The main action: record a transaction with AI, above everything else.
          <Link
            href={catatHref}
            onClick={onNavigate}
            aria-current={onCatat ? "page" : undefined}
            className={cx(
              "flex min-h-8 items-center justify-center gap-1.5 rounded-lg bg-accent-solid px-3 text-body-medium text-on-accent outline-none transition-[background-color,transform] duration-150 max-sm:min-h-11",
              "hover:bg-accent-solid-hover focus-visible:ring-2 focus-visible:ring-border-focus-ring active:scale-[0.98]",
              onCatat && "ring-2 ring-accent-300 ring-offset-2 ring-offset-background-secondary-default",
            )}
          >
            <RiAddLine className="size-4 shrink-0" aria-hidden />
            <span className="text-body-semibold">Catat</span>
          </Link>
        ) : null}
        <nav aria-label="Main" className="flex flex-col gap-4">
          {groupNav(nav).map((group) => {
            // Finance and Others get a heading; the book's own pages and account pages don't.
            const titled = group.key === "finance" || group.key === "others";
            const headingId = `${navId}-${group.key}`;
            return (
              <div key={group.key} role="group" aria-labelledby={titled ? headingId : undefined} className="flex flex-col gap-0.5">
                {titled ? (
                  <h2 id={headingId} className="px-2 pb-1 text-caption-1-semibold text-text-tertiary">
                    {group.label}
                  </h2>
                ) : null}
                {group.items.map((item) => (
                  <NavLink key={item.href} item={item} active={isActive(pathname, item)} onNavigate={onNavigate} />
                ))}
              </div>
            );
          })}
        </nav>
      </div>

      {/* Footer: one account row (menu behind it) and a quiet theme icon. */}
      <div className="flex items-center gap-1">
        <AccountMenu user={user} current={current} initials={initials} signOutAction={signOutAction} onNavigate={onNavigate} />
        <ThemeToggle collapsed />
      </div>
    </div>
  );
}

function NavLink({ item, active, onNavigate }: { item: ResolvedNav; active: boolean; onNavigate?: () => void }) {
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cx(
        "flex h-7 items-center justify-between rounded-lg px-2 outline-none transition-colors",
        "focus-visible:ring-2 focus-visible:ring-border-focus-ring",
        // Soft raised pill: the solid blue is kept for the Catat call to action.
        active ? "bg-background-primary-default shadow-xs" : "hover:bg-background-secondary-hover",
      )}
    >
      <span className="flex items-center gap-2">
        <item.icon className={cx("size-4 shrink-0", active ? "text-button-ghost-foreground" : "text-foreground-icon-secondary")} aria-hidden />
        <span className={cx(active ? "text-body-medium text-text-primary" : "text-body-medium text-text-secondary")}>{item.label}</span>
      </span>
      <NavTrailing badge={item.badge} />
    </Link>
  );
}

function AccountMenu({
  user,
  current,
  initials,
  signOutAction,
  onNavigate,
}: Pick<ShellProps, "user" | "current" | "signOutAction"> & { initials: string; onNavigate?: () => void }) {
  const [signingOut, startSignOut] = useTransition();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Account menu"
        className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-2lg p-1.5 text-start outline-none hover:bg-background-secondary-hover focus-visible:ring-2 focus-visible:ring-border-focus-ring data-[state=open]:bg-background-secondary-hover"
      >
        <Avatar size="md" initials={initials} />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-body-medium text-text-primary">{user.name}</span>
          <span className="truncate text-body-2-regular text-text-tertiary">{user.email}</span>
        </span>
        <RiExpandUpDownLine className="size-4 shrink-0 text-foreground-icon-tertiary" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-56">
        {current ? (
          <DropdownMenuLabel>
            {ROLE_INFO[current.role].label} in {current.name}
          </DropdownMenuLabel>
        ) : null}
        <DropdownMenuItem asChild>
          <Link href={accountHref(current)} onClick={onNavigate}>
            <RiUserLine aria-hidden />
            Account settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => startSignOut(() => signOutAction())}>
          <RiLogoutBoxRLine aria-hidden />
          {signingOut ? "Signing out…" : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Phone tab bar: Dashboard, Transactions, (+), Budget, More. */
const TAB_PATHS = ["", "/transactions", "/budget"];

export function AppSidebar({ quickAdd, ...props }: ShellProps & { quickAdd?: FormOptions }) {
  const pathname = usePathname();
  const canAdd = useCan("data:write") && Boolean(quickAdd && props.current);
  const nav = navFor(props);
  const tabs = props.current
    ? TAB_PATHS.map((p) => nav.find((n) => n.href === `/b/${props.current!.id}${p}`)).filter((n): n is ResolvedNav => Boolean(n))
    : nav.slice(0, 2);
  const catatHref = props.current ? `/b/${props.current.id}/catat` : "";
  const onCatat = Boolean(catatHref) && pathname === catatHref;
  const inMore = !onCatat && !tabs.some((t) => isActive(pathname, t));
  const initials = (props.user.name || props.user.email).slice(0, 1).toUpperCase();

  const tab = (active: boolean) =>
    cx(
      "flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5 text-caption-1-medium outline-none",
      "focus-visible:ring-2 focus-visible:ring-border-focus-ring",
      active ? "text-button-ghost-foreground" : "text-text-primary",
    );
  const tabLink = (item: ResolvedNav) => (
    <Link key={item.href} href={item.href} className={tab(isActive(pathname, item))} aria-current={isActive(pathname, item) ? "page" : undefined}>
      <TabContent icon={item.icon} label={item.label === "Your books" ? "Books" : item.label} />
    </Link>
  );

  return (
    <>
      {/* Flat on the canvas, as in Linear: no glass, no card, no edge. */}
      <aside className="sticky top-2 hidden h-[calc(100dvh-16px)] w-[232px] shrink-0 overflow-y-auto p-2 lg:block">
        <SidebarPanel {...props} />
      </aside>

      {/* Phone / tablet: slim top bar (book switcher) + bottom tab bar */}
      <header className="glass glass-full sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-separator-border bg-background-full px-3 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))] lg:hidden">
        <div className="min-w-0 flex-1">
          <BookSwitcher books={props.books} current={props.current} compact />
        </div>
        <Link href={accountHref(props.current)} aria-label="Account settings" className="shrink-0 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring">
          <Avatar size="md" initials={initials} />
        </Link>
      </header>

      <nav
        aria-label="Main"
        className="glass glass-full fixed inset-x-0 bottom-0 z-30 border-t border-separator-border bg-background-full px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5 lg:hidden"
      >
        <div className="mx-auto flex max-w-lg items-end gap-1">
          {tabs.slice(0, 2).map(tabLink)}
          {canAdd ? (
            <div className="flex flex-1 justify-center">
              <Link
                href={catatHref}
                aria-current={onCatat ? "page" : undefined}
                className="-mt-5 flex flex-col items-center gap-0.5 rounded-full pb-1.5 outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring"
              >
                <span className="flex size-14 items-center justify-center rounded-full bg-accent-solid text-on-accent ring-4 ring-background-full active:scale-95">
                  <RiAddLine className="size-7" aria-hidden />
                </span>
                <span className="text-caption-1-medium text-button-ghost-foreground">Catat</span>
              </Link>
            </div>
          ) : null}
          {tabs.slice(2).map(tabLink)}
          <Link href={moreHref(props.current)} className={cx(tab(inMore), "relative")} aria-current={inMore ? "page" : undefined}>
            <TabContent icon={RiMoreLine} label="More" />
            {props.badges.unverified ? (
              <span className="absolute end-[calc(50%-1.1rem)] top-1 size-2 rounded-full bg-accent-solid" aria-label="Items to reconcile" />
            ) : null}
          </Link>
        </div>
      </nav>

    </>
  );
}

/** A sidebar item's end: a spinner while its page is on the way, else its badge. Must render inside the Link. */
function NavTrailing({ badge }: { badge?: string | number }) {
  const { pending } = useLinkStatus();
  if (pending) return <SpinnerGlyph size="xs" />;
  return badge ? <Badge color="neutral">{badge}</Badge> : null;
}

/** A tab bar item that dims and pulses while its page is on the way. Must render inside the Link. */
function TabContent({ icon: Icon, label }: { icon: RemixiconComponentType; label: string }) {
  const { pending } = useLinkStatus();
  return (
    <span className={cx("flex min-w-0 flex-col items-center gap-0.5 transition-opacity", pending && "animate-pulse opacity-60 motion-reduce:animate-none")}>
      <Icon className="size-6" aria-hidden />
      <span className="truncate">{label}</span>
    </span>
  );
}
