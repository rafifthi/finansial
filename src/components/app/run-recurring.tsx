"use client";

import { useTransition } from "react";
import { RiPlayLine } from "@remixicon/react";
import { runRecurringNow } from "@/actions/entities";
import { Button } from "@/components/base/buttons/button";
import { toast } from "@/components/base/toast/toast";
import { useBookId, useCan } from "./permissions";

export function RunRecurringButton() {
  const [pending, startTransition] = useTransition();
  const bookId = useBookId();
  if (!useCan("data:write")) return null;
  return (
    <Button
      variant="secondary"
      leadingIcon={RiPlayLine}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await runRecurringNow(bookId, {});
          if (!res.ok) return void toast("Couldn't run", { status: "error", description: res.error });
          const n = res.data?.created ?? 0;
          toast(n ? `Booked ${n} transaction${n === 1 ? "" : "s"}` : "Nothing due", { status: "success" });
        })
      }
    >
      {pending ? "Running…" : "Run now"}
    </Button>
  );
}
