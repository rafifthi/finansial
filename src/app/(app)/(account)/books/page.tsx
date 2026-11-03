import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { RiAddLine, RiArrowRightSLine } from "@remixicon/react";
import { currentUser } from "@/auth";
import { BookIcon, KIND_LABEL } from "@/components/app/book-switcher";
import { PageHeader } from "@/components/app/page-header";
import { Chip } from "@/components/base/badges/chip";
import { ButtonLink } from "@/components/base/buttons/button";
import { ROLE_INFO } from "@/lib/auth/roles";
import { booksOf } from "@/lib/data/registry";

export const metadata: Metadata = { title: "Your books" };

export default async function BooksPage() {
  const me = await currentUser();
  if (!me) redirect("/login");
  const books = await booksOf(me.id);

  if (books.length === 0) {
    return (
      <section className="glass mx-auto mt-6 flex w-full max-w-lg flex-col items-center gap-5 rounded-3xl border border-border-button-default bg-background-primary-default p-8 text-center">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-linear-to-b from-accent-500 to-accent-600 text-title-2-semibold text-white">
          F
        </span>
        <div className="flex flex-col gap-1.5">
          <h1 className="text-title-2-semibold text-text-primary">Welcome, {me.name}</h1>
          <p className="text-body-regular text-text-secondary">
            A <span className="text-text-primary">book</span> is one set of finances in its own Google Sheet: a Family book you
            share, or a Personal one only you can see.
          </p>
        </div>
        <ButtonLink href="/books/new" variant="primary" leadingIcon={RiAddLine}>
          Create your first book
        </ButtonLink>
      </section>
    );
  }

  return (
    <>
      <PageHeader
        title="Your books"
        description="Each book has its own spreadsheet, members and settings."
        actions={
          <ButtonLink href="/books/new" variant="primary" leadingIcon={RiAddLine}>
            New book
          </ButtonLink>
        }
      />
      <ul className="grid gap-3 md:grid-cols-2">
        {books.map(({ book, membership }) => {
          const ready = book.status === "active";
          return (
            <li key={book.id}>
              <Link
                href={ready ? `/b/${book.id}` : `/books/new?resume=${book.id}`}
                className="glass flex items-center gap-3 rounded-3xl border border-border-button-default bg-background-primary-default p-4 outline-none hover:bg-background-primary-hover focus-visible:ring-2 focus-visible:ring-border-focus-ring"
              >
                <BookIcon kind={book.kind} className="size-10" />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-headline-semibold text-text-primary">{book.name}</span>
                  <span className="flex flex-wrap items-center gap-1.5">
                    <Chip variant="caption" color={book.kind === "personal" ? "purple" : "blue"}>
                      {KIND_LABEL[book.kind]}
                    </Chip>
                    <Chip variant="caption" color="neutral">
                      {ROLE_INFO[membership.role].label}
                    </Chip>
                    {!ready ? <Chip variant="caption" color="yellow">Finish setup</Chip> : null}
                  </span>
                </span>
                <RiArrowRightSLine className="size-5 text-foreground-icon-tertiary rtl:-scale-x-100" aria-hidden />
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}
