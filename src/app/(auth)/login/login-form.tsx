"use client";

import { useActionState } from "react";
import { RiLockLine, RiMailLine } from "@remixicon/react";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { login, type LoginState } from "./actions";

export function LoginForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(login, {});
  return (
    <form action={formAction} className="flex w-full flex-col gap-4">
      <input type="hidden" name="next" value={next} />
      <Input
        label="Email"
        name="email"
        type="email"
        autoComplete="username"
        leadingIcon={RiMailLine}
        defaultValue={state.email}
        isRequired
        autoFocus
      />
      <Input label="Password" name="password" type="password" autoComplete="current-password" leadingIcon={RiLockLine} isRequired />
      {state.error ? (
        <p role="alert" className="rounded-xl bg-background-secondary-default p-3 text-body-2-regular text-text-error-primary">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" variant="primary" disabled={pending} className="w-full">
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
