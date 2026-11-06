"use client";

import { useState } from "react";
import { RiDeleteBinLine } from "@remixicon/react";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import type { TodoList } from "@/lib/sheets/schema";
import { CategoryIdentityField } from "../category-identity-field";
import { DrawerForm, FormDrawer } from "../form-drawer";
import type { ListInput } from "./use-lists";

/** Create a list, or change one's name, emoji and colour. */
export function ListDrawer({
  list,
  isOpen,
  onClose,
  onSave,
  onDelete,
}: {
  /** The list being edited; a new list when absent. */
  list: TodoList | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (input: Omit<ListInput, "id"> & { id?: string }) => void;
  onDelete?: (list: TodoList) => void;
}) {
  return (
    <FormDrawer isOpen={isOpen} onOpenChange={(o) => !o && onClose()} aria-label={list ? "Edit list" : "New list"}>
      <ListForm list={list} onClose={onClose} onSave={onSave} onDelete={onDelete} />
    </FormDrawer>
  );
}

function ListForm({
  list,
  onClose,
  onSave,
  onDelete,
}: {
  list: TodoList | null;
  onClose: () => void;
  onSave: (input: Omit<ListInput, "id"> & { id?: string }) => void;
  onDelete?: (list: TodoList) => void;
}) {
  const [name, setName] = useState(list?.name ?? "");
  const [identity, setIdentity] = useState({ emoji: list?.emoji ?? "", color: list?.color || "blue" });
  const [error, setError] = useState<string | null>(null);

  function submit() {
    const trimmed = name.trim();
    if (!trimmed) return setError("Give the list a name");
    onSave({ id: list?.id, name: trimmed, ...identity });
    onClose();
  }

  return (
    <DrawerForm
      title={list ? "Edit list" : "New list"}
      onSubmit={submit}
      error={error}
      destructive={
        list && onDelete ? (
          <Button
            type="button"
            variant="ghost"
            leadingIcon={RiDeleteBinLine}
            className="bg-transparent text-text-error-primary hover:bg-background-tertiary-error active:bg-background-tertiary-error"
            onClick={() => {
              onDelete(list);
              onClose();
            }}
          >
            Delete list
          </Button>
        ) : undefined
      }
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary">
            {list ? "Save" : "Create list"}
          </Button>
        </>
      }
    >
      <Input
        label="Name"
        isRequired
        autoFocus={!list}
        value={name}
        onChange={(v) => {
          setName(v);
          setError(null);
        }}
        placeholder="e.g. Groceries"
        maxLength={60}
        isInvalid={Boolean(error)}
        errorMessage={error}
      />
      <CategoryIdentityField name={name} group="" emoji={identity.emoji} color={identity.color} onChange={(patch) => setIdentity((v) => ({ ...v, ...patch }))} />
    </DrawerForm>
  );
}
