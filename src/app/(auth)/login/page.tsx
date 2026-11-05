import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser } from "@/auth";
import { DEMO_PASSWORD, DEMO_USERS } from "@/lib/data/demo-seed";
import { registry, registryConfigured } from "@/lib/data/registry";
import { usingDemoDb } from "@/lib/data/store";
import { Logo } from "@/components/app/logo";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const user = await currentUser().catch(() => null);
  if (user) redirect("/");
  const { callbackUrl } = await searchParams;
  const next = typeof callbackUrl === "string" ? new URL(callbackUrl, "http://x").pathname : "/";

  // A brand-new DB has no users yet: point at the bootstrap command.
  const noUsers = registryConfigured()
    ? await registry()
        .rows("users")
        .then((u) => u.length === 0)
        .catch(() => false)
    : false;

  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <section className="flex w-full max-w-sm flex-col items-center gap-6 rounded-3xl border border-separator-border bg-background-primary-default p-8 shadow-sidebar">
        <Logo className="size-12 rounded-2xl" />
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-title-2-semibold text-text-primary">Finansial</h1>
          <p className="text-body-regular text-text-tertiary">Sign in to your household.</p>
        </div>
        {noUsers ? (
          <p className="w-full rounded-xl bg-background-secondary-default p-3 text-body-2-regular text-text-secondary">
            No users yet. Create the first admin with{" "}
            <code className="text-text-primary">pnpm user:add --email you@example.com --role admin</code>
          </p>
        ) : null}
        <LoginForm next={next} />
        {usingDemoDb() ? (
          <p className="w-full text-center text-body-2-regular text-text-tertiary">
            Demo: {DEMO_USERS.map((u) => u.email).join(", ")} · password <code>{DEMO_PASSWORD}</code>
          </p>
        ) : null}
      </section>
    </main>
  );
}
