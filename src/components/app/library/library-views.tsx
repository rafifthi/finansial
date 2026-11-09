"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { RiAddLine, RiFileTextLine } from "@remixicon/react";
import { Button } from "@/components/base/buttons/button";
import { pageTitle } from "@/lib/library/tree";
import type { Page, PageBlock } from "@/lib/sheets/schema";
import { cx } from "@/utils/cx";
import { EmptyState } from "../card";
import { PageHeader } from "../page-header";
import { LibraryProvider, useLibrary } from "./library-context";
import { PageEditor } from "./page-editor";
import { PageTree } from "./page-tree";

const PANEL = "rounded-3xl border border-separator-border bg-background-primary-default";

/** The tree beside every Library screen on desktop; on phones the Library home is the tree. */
export function LibraryShell({ initial, canEdit, user, children }: { initial: Page[]; canEdit: boolean; user: string; children: ReactNode }) {
  return (
    <LibraryProvider initial={initial} canEdit={canEdit} user={user}>
      <div className="grid items-start gap-4 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <aside className={cx(PANEL, "sticky top-4 max-h-[calc(100dvh-3rem)] overflow-y-auto p-2 max-lg:hidden")}>
          <PageTree />
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </LibraryProvider>
  );
}

function when(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function LibraryHome() {
  const { pages, canEdit, create, href } = useLibrary();
  const recent = pages
    .filter((p) => !p.archived)
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    .slice(0, 8);
  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <PageHeader
        title="Library"
        description="The household's pages: how-tos, contacts, plans."
        actions={canEdit ? <Button leadingIcon={RiAddLine} onClick={() => create()}>New page</Button> : undefined}
      />
      <div className={cx(PANEL, "p-2 lg:hidden")}>
        <PageTree />
      </div>
      <section aria-labelledby="library-recent" className="flex flex-col gap-2 max-lg:hidden">
        <h2 id="library-recent" className="px-1 text-caption-1-semibold text-text-tertiary">
          Recently edited
        </h2>
        {recent.length ? (
          <ul className={cx(PANEL, "flex flex-col overflow-hidden")}>
            {recent.map((p) => (
              <li key={p.id} className="border-b border-separator-border last:border-b-0">
                <Link href={href(p.id)} className="flex min-h-11 items-center gap-3 px-4 outline-none transition-colors hover:bg-background-secondary-hover focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-border-focus-ring">
                  {p.emoji ? (
                    <span className="w-4 text-center" aria-hidden>
                      {p.emoji}
                    </span>
                  ) : (
                    <RiFileTextLine className="size-4 shrink-0 text-foreground-icon-tertiary" aria-hidden />
                  )}
                  <span className="min-w-0 flex-1 truncate text-body-medium text-text-primary">{pageTitle(p)}</span>
                  <span className="shrink-0 text-body-2-regular text-text-tertiary">{when(p.updated_at)}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState>{canEdit ? "Start with a page for something you keep looking up: Wi-Fi passwords, who to call, how to pay a bill." : "No pages yet."}</EmptyState>
        )}
      </section>
    </div>
  );
}

/**
 * A page route. A page made a moment ago in this browser may not be in the
 * sheet yet, so it opens empty from the local list instead of "not found".
 */
export function LibraryPage({ id, page, rows }: { id: string; page: Page | null; rows: PageBlock[] }) {
  const { pages, href } = useLibrary();
  const local = pages.find((p) => p.id === id);
  const shown = page ?? local;
  if (!shown || shown.archived || local?.archived) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 py-10 text-center">
        <p className="text-body-regular text-text-secondary">{shown ? "This page is in the trash." : "This page doesn't exist."}</p>
        <Link href={href()} className="text-body-medium text-button-ghost-foreground underline-offset-2 hover:underline">
          Back to the Library
        </Link>
      </div>
    );
  }
  return <PageEditor key={id} page={shown} rows={page ? rows : []} />;
}
