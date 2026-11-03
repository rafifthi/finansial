"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { RiArchiveLine, RiPencilLine } from "@remixicon/react";
import { archiveBook, renameBook } from "@/actions/books";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { AlertDialog } from "@/components/base/modal/modal";
import { toast } from "@/components/base/toast/toast";
import { DrawerForm, FormDrawer, FormError } from "./form-drawer";
import { useBookId, useCan } from "./permissions";

/** Book name + archive (owner). The kind can't change here: personal → family would expose a private book. */
export function BookDetails({ name, isOwner }: { name: string; isOwner: boolean }) {
  const bookId = useBookId();
  const router = useRouter();
  const canEdit = useCan("setup:write");
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [value, setValue] = useState(name);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!canEdit) return null;
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="secondary" leadingIcon={RiPencilLine} onClick={() => setOpen(true)}>
        Rename
      </Button>
      {isOwner ? (
        <Button variant="ghost" leadingIcon={RiArchiveLine} onClick={() => setConfirm(true)}>
          Archive book
        </Button>
      ) : null}
      <FormDrawer isOpen={open} onOpenChange={setOpen} aria-label="Rename book">
        <DrawerForm
          title="Rename book"
          onSubmit={() =>
            startTransition(async () => {
              const res = await renameBook(bookId, { name: value });
              if (!res.ok) return setError(res.error);
              toast("Renamed", { status: "success" });
              setOpen(false);
            })
          }
          footer={
            <>
              <span className="hidden sm:block" />
              <Button type="submit" variant="primary" disabled={pending}>
                {pending ? "Saving…" : "Save"}
              </Button>
            </>
          }
        >
          <Input label="Name" value={value} onChange={setValue} isRequired autoFocus maxLength={60} />
          <FormError>{error}</FormError>
        </DrawerForm>
      </FormDrawer>
      <AlertDialog
        isOpen={confirm}
        onOpenChange={setConfirm}
        title={`Archive ${name}?`}
        description="It disappears for everyone in it. The spreadsheet in your Google Drive is not changed or deleted."
        variant="danger"
        confirmLabel="Archive"
        onConfirm={async () => {
          const res = await archiveBook(bookId, { confirm: true });
          if (!res.ok) return void toast("Couldn't archive", { status: "error", description: res.error });
          toast("Book archived", { status: "success" });
          router.push("/books");
          router.refresh();
        }}
      />
    </div>
  );
}
