import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser } from "@/auth";
import { NewBookWizard, type ResumeInfo } from "@/components/app/new-book-wizard";
import { PageHeader } from "@/components/app/page-header";
import { registry } from "@/lib/data/registry";
import { usingDemoDb } from "@/lib/data/store";
import { serviceAccountEmail } from "@/lib/sheets/client";

export const metadata: Metadata = { title: "New book" };

export default async function NewBookPage({ searchParams }: PageProps<"/books/new">) {
  const me = await currentUser();
  if (!me) redirect("/login");
  const { resume } = await searchParams;

  let resumeInfo: ResumeInfo | undefined;
  if (typeof resume === "string") {
    const book = (await registry().rows("books")).find((b) => b.id === resume);
    if (book?.status === "active") redirect(`/b/${book.id}`);
    if (book && book.owner_user_id === me.id) {
      resumeInfo = { id: book.id, name: book.name, kind: book.kind, step: book.provision_step, failed: book.status === "error" };
    }
  }

  return (
    <>
      <PageHeader
        title={resumeInfo ? "Finish setting up" : "New book"}
        description="A book is one set of finances in its own Google Sheet. Finansial checks the sheet before it writes anything."
      />
      <NewBookWizard
        serviceAccount={usingDemoDb() ? "finansial-demo@demo.iam.gserviceaccount.com" : serviceAccountEmail()}
        userEmail={me.email}
        demo={usingDemoDb()}
        resume={resumeInfo}
      />
    </>
  );
}
