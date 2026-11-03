import { redirect } from "next/navigation";
import { currentUser } from "@/auth";
import { AppToaster } from "@/components/app/app-toaster";
import { SetupNotice } from "@/components/app/setup-notice";
import { registryConfigured } from "@/lib/data/registry";

/** Everything behind sign-in. Book and account layouts below add the shell. */
export default async function AuthenticatedLayout({ children }: LayoutProps<"/">) {
  if (!registryConfigured()) {
    return (
      <SetupNotice
        title="Finish the multi-book upgrade"
        message="REGISTRY_SPREADSHEET_ID is not set. Create a blank Google Sheet, share it with the service account as Editor, put its ID in .env.local, then run: pnpm migrate:multibook"
      />
    );
  }
  let user;
  try {
    user = await currentUser();
  } catch (err) {
    return <SetupNotice message={err instanceof Error ? err.message : String(err)} />;
  }
  if (!user) redirect("/login");
  return (
    <>
      {children}
      <AppToaster />
    </>
  );
}
