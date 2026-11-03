import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser } from "@/auth";
import { personalSections } from "@/components/app/account-settings";
import { PageHeader } from "@/components/app/page-header";
import { SettingsTabs } from "@/components/app/settings-tabs";

export const metadata: Metadata = { title: "Settings" };

/** Settings outside a book: just the personal tabs. Book tabs live at /b/<id>/settings. */
export default async function AccountSettingsPage() {
  const me = await currentUser();
  if (!me) redirect("/login");
  return (
    <>
      <PageHeader title="Settings" description="Your account and how the app looks on this device." />
      <SettingsTabs sections={await personalSections(me)} />
    </>
  );
}
