"use client";

import { useState, useTransition } from "react";
import { RiFileCopyLine, RiLock2Line, RiPencilLine, RiUserAddLine, RiUserMinusLine } from "@remixicon/react";
import { inviteMember, removeMember, updateMember } from "@/actions/members";
import { Avatar } from "@/components/base/avatar/avatar";
import { Chip } from "@/components/base/badges/chip";
import { Button } from "@/components/base/buttons/button";
import { IconButton } from "@/components/base/buttons/icon-button";
import { Input } from "@/components/base/input/input";
import { AlertDialog, Modal, ModalBody, ModalFooter, ModalHeader } from "@/components/base/modal/modal";
import { toast } from "@/components/base/toast/toast";
import { ROLE_INFO, type Role } from "@/lib/auth/roles";
import { SelectField } from "./fields";
import { DrawerForm, FormDrawer } from "./form-drawer";
import { useBookId } from "./permissions";

export interface MemberRow {
  userId: string;
  name: string;
  email: string;
  role: Role;
  member: string;
  lastLoginAt: string;
  isOwner: boolean;
}

const ROLE_OPTIONS = (Object.keys(ROLE_INFO) as Role[]).map((r) => ({ id: r, label: ROLE_INFO[r].label }));

type Draft = { userId?: string; email: string; name: string; role: Role; member: string };

const lastSeen = (iso: string) =>
  iso ? `Last sign-in ${new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso))}` : "Never signed in";

export function MembersManager({
  members,
  householdMembers,
  currentUserId,
  personal,
}: {
  members: MemberRow[];
  householdMembers: string[];
  currentUserId: string;
  personal: boolean;
}) {
  // Kept after closing so the panels don't go blank during their exit animation.
  const [draft, setDraft] = useState<Draft | null>(null);
  const [open, setOpen] = useState(false);
  const [secret, setSecret] = useState<{ email: string; password: string } | null>(null);
  const [secretOpen, setSecretOpen] = useState(false);
  const edit = (d: Draft) => {
    setDraft(d);
    setOpen(true);
  };

  return (
    <>
      {personal ? (
        <div className="flex items-start gap-3 rounded-3xl border border-border-button-default bg-background-primary-default p-4">
          <RiLock2Line className="mt-0.5 size-5 shrink-0 text-foreground-icon-secondary" aria-hidden />
          <p className="text-body-regular text-text-secondary">
            This is a <span className="text-text-primary">personal book</span>: only you can open it. To share money with
            others, create a Family book.
          </p>
        </div>
      ) : (
        <div className="flex justify-end">
          <Button variant="primary" leadingIcon={RiUserAddLine} onClick={() => edit({ email: "", name: "", role: "member", member: "" })}>
            Invite someone
          </Button>
        </div>
      )}

      <ul className="flex flex-col divide-y divide-separator-border overflow-hidden rounded-3xl border border-border-button-default bg-background-primary-default">
        {members.map((m) => (
          <li key={m.userId} className="flex items-center gap-3 px-4 py-3">
            <Avatar size="md" initials={m.name.slice(0, 1).toUpperCase()} />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="truncate text-body-medium text-text-primary">{m.name}</span>
                <Chip variant="caption" color={m.role === "admin" ? "blue" : m.role === "member" ? "lime" : "neutral"}>
                  {ROLE_INFO[m.role].label}
                </Chip>
                {m.isOwner ? <Chip variant="caption" color="soft">Owner</Chip> : null}
                {m.userId === currentUserId ? <Chip variant="caption" color="soft">You</Chip> : null}
              </div>
              <span className="truncate text-body-2-regular text-text-tertiary">
                {m.email}
                {m.member ? ` · ${m.member}` : ""} · {lastSeen(m.lastLoginAt)}
              </span>
            </div>
            <IconButton size="small" icon={RiPencilLine} aria-label={`Edit ${m.name}`} onClick={() => edit({ ...m })} />
          </li>
        ))}
      </ul>

      <FormDrawer isOpen={open} onOpenChange={setOpen} aria-label="Member">
        {draft ? (
          <MemberForm
            key={draft.userId ?? "new"}
            initial={draft}
            householdMembers={householdMembers}
            isSelf={draft.userId === currentUserId}
            personal={personal}
            onDone={(created) => {
              setOpen(false);
              if (created) {
                setSecret(created);
                setSecretOpen(true);
              }
            }}
          />
        ) : null}
      </FormDrawer>

      <Modal isOpen={secretOpen} onOpenChange={setSecretOpen} size="sm">
        {secret ? (
          <div className="flex flex-col gap-4">
            <ModalHeader title="Temporary password" description={`Give this to ${secret.email}. It won't be shown again; they can change it under Profile.`} />
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

function MemberForm({
  initial,
  householdMembers,
  isSelf,
  personal,
  onDone,
}: {
  initial: Draft;
  householdMembers: string[];
  isSelf: boolean;
  personal: boolean;
  onDone: (created?: { email: string; password: string }) => void;
}) {
  const bookId = useBookId();
  const [draft, setDraft] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const isNew = !draft.userId;
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  const submit = () =>
    startTransition(async () => {
      setError(null);
      if (isNew) {
        const res = await inviteMember(bookId, { email: draft.email, name: draft.name, role: draft.role, member: draft.member });
        if (!res.ok) return setError(res.error);
        toast(res.data?.existing ? "Added to this book" : "Account created and added", { status: "success" });
        onDone(res.data?.password ? { email: draft.email.trim().toLowerCase(), password: res.data.password } : undefined);
      } else {
        const res = await updateMember(bookId, { userId: draft.userId!, role: draft.role, member: draft.member });
        if (!res.ok) return setError(res.error);
        toast("Saved", { status: "success" });
        onDone();
      }
    });

  const [confirmRemove, setConfirmRemove] = useState(false);
  const remove = async () => {
    const res = await removeMember(bookId, { userId: draft.userId! });
    if (!res.ok) {
      setError(res.error);
      throw new Error(res.error);
    }
    toast(`${draft.name} was removed from this book`, { status: "success" });
    onDone();
  };

  return (
    <DrawerForm
      title={isNew ? "Invite someone" : `Edit ${initial.name}`}
      description={
        isNew ? "If they don't have an account yet, one is created with a temporary password for you to pass on." : initial.email
      }
      onSubmit={submit}
      error={error}
      destructive={
        !isNew && !isSelf ? (
          <Button type="button" variant="ghost" leadingIcon={RiUserMinusLine} onClick={() => setConfirmRemove(true)} disabled={pending} className="bg-transparent text-text-error-primary hover:bg-background-tertiary-error active:bg-background-tertiary-error">
            Remove from book
          </Button>
        ) : null
      }
      footer={
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Saving…" : isNew ? "Invite" : "Save"}
        </Button>
      }
    >
      <AlertDialog
        isOpen={confirmRemove}
        onOpenChange={setConfirmRemove}
        title={`Remove ${draft.name}?`}
        description={`${draft.name} loses access to this book straight away. Their transactions stay. You can invite them again later.`}
        confirmLabel="Remove"
        pendingLabel="Removing…"
        onConfirm={remove}
      />
      {isNew ? (
        <>
          <Input label="Email" type="email" value={draft.email} onChange={(v) => set("email", v)} isRequired autoFocus />
          <Input label="Name" hint="Used if they're new to Finansial" value={draft.name} onChange={(v) => set("name", v)} />
        </>
      ) : null}
      <SelectField
        label="Role in this book"
        value={draft.role}
        onChange={(v) => set("role", v as Role)}
        options={ROLE_OPTIONS}
        isDisabled={isSelf || personal}
        hint={isSelf ? "You can't change your own role." : personal ? "The owner of a personal book is always its admin." : ROLE_INFO[draft.role].description}
      />
      {householdMembers.length ? (
        <SelectField
          label="Household member"
          value={draft.member}
          onChange={(v) => set("member", v)}
          options={householdMembers.map((m) => ({ id: m, label: m }))}
          allowEmpty="None"
        />
      ) : null}
    </DrawerForm>
  );
}
