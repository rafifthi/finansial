"use client";

import { useState, useTransition } from "react";
import { RiLockPasswordLine, RiPencilLine } from "@remixicon/react";
import { changePassword, updateProfile } from "@/actions/account";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { toast } from "@/components/base/toast/toast";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/constants";
import { DrawerForm, FormDrawer, FormError } from "./form-drawer";

export function ProfileCard({ name }: { name: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col gap-4">
      <dl className="flex flex-col text-body-regular">
        <dt className="text-body-2-medium text-text-tertiary">Name</dt>
        <dd className="text-text-primary">{name}</dd>
      </dl>
      <Button variant="secondary" leadingIcon={RiPencilLine} onClick={() => setOpen(true)} className="self-start">
        Edit profile
      </Button>
      <FormDrawer isOpen={open} onOpenChange={setOpen} aria-label="Edit profile">
        <ProfileForm name={name} onDone={() => setOpen(false)} />
      </FormDrawer>
    </div>
  );
}

function ProfileForm({ name, onDone }: { name: string; onDone: () => void }) {
  const [value, setValue] = useState(name);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <DrawerForm
      title="Edit profile"
      onSubmit={() =>
        startTransition(async () => {
          setError(null);
          const res = await updateProfile({ name: value });
          if (!res.ok) return setError(res.error);
          toast("Profile saved", { status: "success" });
          onDone();
        })
      }
      footer={
        <>
          <span className="hidden sm:block" />
          <Button type="submit" variant="primary" disabled={pending}>
            {pending ? "Saving…" : "Save profile"}
          </Button>
        </>
      }
    >
      <Input label="Name" value={value} onChange={setValue} isRequired autoFocus />
      <FormError>{error}</FormError>
    </DrawerForm>
  );
}

export function PasswordCard() {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col gap-4">
      <p className="text-body-regular text-text-secondary">Use at least {MIN_PASSWORD_LENGTH} characters. You stay signed in on this device.</p>
      <Button variant="secondary" leadingIcon={RiLockPasswordLine} onClick={() => setOpen(true)} className="self-start">
        Change password
      </Button>
      <FormDrawer isOpen={open} onOpenChange={setOpen} aria-label="Change password">
        <PasswordForm onDone={() => setOpen(false)} />
      </FormDrawer>
    </div>
  );
}

function PasswordForm({ onDone }: { onDone: () => void }) {
  const [values, setValues] = useState({ current: "", next: "", confirm: "" });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const set = (k: keyof typeof values) => (v: string) => setValues((s) => ({ ...s, [k]: v }));
  return (
    <DrawerForm
      title="Change password"
      onSubmit={() => {
        setError(null);
        if (values.next !== values.confirm) return setError("The new passwords don't match.");
        startTransition(async () => {
          const res = await changePassword({ current: values.current, next: values.next });
          if (!res.ok) return setError(res.error);
          toast("Password changed", { status: "success" });
          onDone();
        });
      }}
      footer={
        <>
          <span className="hidden sm:block" />
          <Button type="submit" variant="primary" disabled={pending}>
            {pending ? "Changing…" : "Change password"}
          </Button>
        </>
      }
    >
      <Input label="Current password" type="password" autoComplete="current-password" value={values.current} onChange={set("current")} isRequired autoFocus />
      <Input
        label="New password"
        type="password"
        autoComplete="new-password"
        hint={`At least ${MIN_PASSWORD_LENGTH} characters`}
        value={values.next}
        onChange={set("next")}
        isRequired
      />
      <Input label="Repeat new password" type="password" autoComplete="new-password" value={values.confirm} onChange={set("confirm")} isRequired />
      <FormError>{error}</FormError>
    </DrawerForm>
  );
}
