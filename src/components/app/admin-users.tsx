"use client";

import { useState, useTransition } from "react";
import { RiFileCopyLine, RiKeyLine } from "@remixicon/react";
import { resetUserPassword, setUserFlags } from "@/actions/admin";
import { Avatar } from "@/components/base/avatar/avatar";
import { Chip } from "@/components/base/badges/chip";
import { Button } from "@/components/base/buttons/button";
import { IconButton } from "@/components/base/buttons/icon-button";
import { AlertDialog, Modal, ModalBody, ModalFooter, ModalHeader } from "@/components/base/modal/modal";
import { Switch } from "@/components/base/switch/switch";
import { toast } from "@/components/base/toast/toast";
import { cx } from "@/utils/cx";

export interface AdminUserRow {
  id: string;
  name: string;
  email: string;
  disabled: boolean;
  isSystemAdmin: boolean;
  lastLoginAt: string;
  books: number;
}

/** Deployment-wide user list for system admins: disable, promote, reset passwords. No book data. */
export function AdminUsers({ users, currentUserId }: { users: AdminUserRow[]; currentUserId: string }) {
  const [pending, startTransition] = useTransition();
  const [secret, setSecret] = useState<{ email: string; password: string } | null>(null);
  const [secretOpen, setSecretOpen] = useState(false);
  const [resetting, setResetting] = useState<AdminUserRow | null>(null);
  const reset = async () => {
    if (!resetting) return;
    const res = await resetUserPassword({ id: resetting.id });
    if (!res.ok) {
      toast("Couldn't reset", { status: "error", description: res.error });
      throw new Error(res.error);
    }
    setSecret({ email: resetting.email, password: res.data!.password });
    setResetting(null);
    setSecretOpen(true);
  };

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, done: string) =>
    startTransition(async () => {
      const res = await fn();
      toast(res.ok ? done : "Couldn't save", { status: res.ok ? "success" : "error", description: res.ok ? undefined : res.error });
    });

  return (
    <>
      <ul className="glass flex flex-col divide-y divide-separator-border overflow-hidden rounded-3xl border border-border-button-default bg-background-primary-default">
        {users.map((u) => (
          <li key={u.id} className={cx("flex flex-wrap items-center gap-3 px-4 py-3", u.disabled && "opacity-60")}>
            <Avatar size="md" initials={u.name.slice(0, 1).toUpperCase()} />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="truncate text-body-medium text-text-primary">{u.name}</span>
                {u.isSystemAdmin ? <Chip variant="caption" color="blue">System admin</Chip> : null}
                {u.disabled ? <Chip variant="caption" color="rose">Disabled</Chip> : null}
                {u.id === currentUserId ? <Chip variant="caption" color="soft">You</Chip> : null}
              </div>
              <span className="truncate text-body-2-regular text-text-tertiary">
                {u.email} · {u.books} book{u.books === 1 ? "" : "s"} · {u.lastLoginAt ? `last sign-in ${u.lastLoginAt.slice(0, 10)}` : "never signed in"}
              </span>
            </div>
            <div className="flex items-center gap-4">
              <Switch
                size="sm"
                isSelected={!u.disabled}
                isDisabled={pending || u.id === currentUserId}
                onChange={(on) => run(() => setUserFlags({ id: u.id, disabled: !on }), on ? "Enabled" : "Disabled")}
              >
                Active
              </Switch>
              <Switch
                size="sm"
                isSelected={u.isSystemAdmin}
                isDisabled={pending || u.id === currentUserId}
                onChange={(on) => run(() => setUserFlags({ id: u.id, is_system_admin: on }), "Saved")}
              >
                Admin
              </Switch>
              <IconButton
                size="small"
                icon={RiKeyLine}
                aria-label={`Reset password for ${u.name}`}
                disabled={pending}
                onClick={() => setResetting(u)}
              />
            </div>
          </li>
        ))}
      </ul>

      <AlertDialog
        isOpen={resetting !== null}
        onOpenChange={(open) => !open && setResetting(null)}
        title={`Reset ${resetting?.name ?? "this user"}'s password?`}
        description="Their current password stops working at once. You'll get a temporary one to pass on."
        confirmLabel="Reset password"
        pendingLabel="Resetting…"
        onConfirm={reset}
      />

      <Modal isOpen={secretOpen} onOpenChange={setSecretOpen} size="sm">
        {secret ? (
          <div className="flex flex-col gap-4">
            <ModalHeader title="Temporary password" description={`Give this to ${secret.email}. It won't be shown again.`} />
            <ModalBody>
              <div className="flex items-center gap-2 rounded-xl bg-background-secondary-default p-3">
                <code className="flex-1 text-headline-medium text-text-primary">{secret.password}</code>
                <IconButton
                  size="small"
                  icon={RiFileCopyLine}
                  aria-label="Copy password"
                  onClick={() => navigator.clipboard.writeText(secret.password).then(() => toast("Copied", { status: "success" }))}
                />
              </div>
            </ModalBody>
            <ModalFooter>
              <Button variant="primary" onClick={() => setSecretOpen(false)}>
                Done
              </Button>
            </ModalFooter>
          </div>
        ) : null}
      </Modal>
    </>
  );
}
