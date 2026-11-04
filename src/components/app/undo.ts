"use client";

import { toast } from "@/components/base/toast/toast";

type Result = { ok: true } | { ok: false; error: string };

/**
 * Deletes in this app happen at once and offer Undo for a few seconds, so a
 * slip of the thumb never costs a row of the household's sheet.
 */
export function undoToast(title: string, undo: () => Promise<Result>) {
  const id = toast(title, {
    status: "success",
    duration: 8000,
    actions: [
      {
        label: "Undo",
        onClick: async () => {
          toast.dismiss(id);
          const res = await undo();
          toast(res.ok ? "Restored" : res.error, { status: res.ok ? "success" : "error" });
        },
      },
    ],
  });
}
