"use client";

import { useState, useTransition } from "react";
import { saveLiveKey } from "@/actions/library-live";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { toast } from "@/components/base/toast/toast";
import type { LiveKeySource } from "@/lib/library/live-key";
import { useBookId, useCan } from "./permissions";

const STATUS: Record<LiveKeySource, string> = {
  book: "On, with this book's key.",
  server: "On, with the server's key. Paste one here to use this book's own Liveblocks project instead.",
  none: "Off until a key is added.",
};

/**
 * The Liveblocks key behind live cursors. Admins paste it here; it's stored
 * sealed in this book's Settings tab and only its ends are ever shown again.
 */
export function LiveKeySettings({ source, hint }: { source: LiveKeySource; hint: string }) {
  const bookId = useBookId();
  const canEdit = useCan("setup:write");
  const [key, setKey] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const save = (value: string) =>
    startTransition(async () => {
      setError("");
      const res = await saveLiveKey(bookId, { key: value });
      if (!res.ok) return setError(res.fieldErrors?.key ?? res.error);
      setKey("");
      toast(value ? "Live cursors are on" : "Key removed", { status: "success" });
    });

  return (
    <div className="flex flex-col gap-4">
      <p className="text-body-regular text-text-secondary">{STATUS[source]}</p>
      {source === "book" && hint ? (
        <dl className="flex flex-col">
          <dt className="text-body-2-medium text-text-tertiary">Key</dt>
          <dd className="text-body-regular text-text-primary" dir="ltr">
            <code>{hint}</code>
          </dd>
        </dl>
      ) : null}
      {canEdit ? (
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (key.trim()) save(key);
          }}
        >
          <Input
            label={source === "book" ? "Replace the secret key" : "Liveblocks secret key"}
            type="password"
            inputDir="ltr"
            autoComplete="off"
            placeholder="sk_prod_…"
            value={key}
            onChange={(v) => {
              setKey(v);
              setError("");
            }}
            isInvalid={Boolean(error)}
            errorMessage={error}
            hint="From liveblocks.io: your project, then API keys. Stored encrypted in this book; only its ends are shown again."
          />
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={!key.trim() || pending}>
              {pending ? "Checking…" : "Save key"}
            </Button>
            {source === "book" ? (
              <Button type="button" variant="secondary" disabled={pending} onClick={() => save("")}>
                Remove key
              </Button>
            ) : null}
          </div>
        </form>
      ) : null}
    </div>
  );
}
