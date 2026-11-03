"use client";

import { useState, useTransition } from "react";
import { RiPencilLine } from "@remixicon/react";
import { saveSettings } from "@/actions/entities";
import { setMyMember } from "@/actions/members";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { toast } from "@/components/base/toast/toast";
import { END_OF_MONTH, periodOf, periodRange } from "@/lib/finance/period";
import { SelectField } from "./fields";
import { DrawerForm, FormDrawer, FormError } from "./form-drawer";
import { monthLabelClient, shortDateClient } from "./format";
import { useBookId, useCan } from "./permissions";

interface Values {
  members: string;
  cutoff_day: number;
  currency: string;
  locale: string;
}

export const CUTOFF_OPTIONS = [
  { id: String(END_OF_MONTH), label: "End of month (calendar months)" },
  ...Array.from({ length: 28 }, (_, i) => ({ id: String(i + 1), label: `Day ${i + 1}` })),
];

export function describeCutoff(cutoff: number, today: string) {
  const period = periodOf(today, cutoff);
  const { start, end } = periodRange(period, cutoff);
  return `${monthLabelClient(period)} runs ${shortDateClient(start)} – ${shortDateClient(end)}`;
}

/** Household settings: read-only summary, edited in a drawer by admins. */
export function HouseholdSettings({ initial, today }: { initial: Values; today: string }) {
  const [open, setOpen] = useState(false);
  const canEdit = useCan("setup:write");
  const rows: [string, string][] = [
    ["Members", initial.members || "—"],
    ["Cut-off day", initial.cutoff_day === END_OF_MONTH ? "End of month" : `Day ${initial.cutoff_day}`],
    ["Currency", initial.currency],
    ["Number format", initial.locale],
  ];
  return (
    <div className="flex flex-col gap-4">
      <dl className="grid grid-cols-2 gap-3 text-body-regular">
        {rows.map(([k, v]) => (
          <div key={k} className="flex min-w-0 flex-col">
            <dt className="text-body-2-medium text-text-tertiary">{k}</dt>
            <dd className="truncate text-text-primary">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="text-body-2-regular text-text-tertiary">Current period: {describeCutoff(initial.cutoff_day, today)}.</p>
      {canEdit ? (
        <Button variant="secondary" leadingIcon={RiPencilLine} onClick={() => setOpen(true)} className="self-start">
          Edit household
        </Button>
      ) : null}
      <FormDrawer isOpen={open} onOpenChange={setOpen} aria-label="Household settings">
        <SettingsForm initial={initial} today={today} onDone={() => setOpen(false)} />
      </FormDrawer>
    </div>
  );
}

function SettingsForm({ initial, today, onDone }: { initial: Values; today: string; onDone: () => void }) {
  const bookId = useBookId();
  const [values, setValues] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const set = <K extends keyof Values>(k: K, v: Values[K]) => setValues((s) => ({ ...s, [k]: v }));

  return (
    <DrawerForm
      title="Household"
      description="Applies to everyone in the household."
      onSubmit={() =>
        startTransition(async () => {
          setError(null);
          const res = await saveSettings(bookId, values);
          if (!res.ok) return setError(res.error);
          toast("Settings saved", { status: "success" });
          onDone();
        })
      }
      footer={
        <>
          <span className="hidden sm:block" />
          <Button type="submit" variant="primary" disabled={pending}>
            {pending ? "Saving…" : "Save settings"}
          </Button>
        </>
      }
    >
      <Input label="Members" hint="Comma-separated, e.g. Kanza, Rafif" value={values.members} onChange={(v) => set("members", v)} />
      <div className="flex flex-col gap-1">
        <SelectField
          label="Cut-off day"
          value={String(values.cutoff_day)}
          onChange={(v) => set("cutoff_day", Number(v) || END_OF_MONTH)}
          options={CUTOFF_OPTIONS}
        />
        <p className="text-body-2-regular text-text-tertiary">
          The last day of each budget period; the next day starts a new one, named after the month it ends in. Use the day
          before payday so each salary funds one period. Now: {describeCutoff(values.cutoff_day, today)}.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input label="Currency" value={values.currency} onChange={(v) => set("currency", v.toUpperCase())} maxLength={3} />
        <Input label="Number format" value={values.locale} onChange={(v) => set("locale", v)} />
      </div>
      <FormError>{error}</FormError>
    </DrawerForm>
  );
}

/**
 * "I am …" — which household member you are in this book, so new
 * transactions pre-fill it. Anyone can set their own.
 */
export function MyMember({ members, current, personal }: { members: string[]; current: string; personal: boolean }) {
  const bookId = useBookId();
  const [pending, startTransition] = useTransition();
  if (personal || members.length === 0) {
    return (
      <p className="text-body-regular text-text-secondary">
        {personal ? "Personal books have just you, so there's nothing to set." : "Add household members (Household → Edit) to link yourself to one."}
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <SelectField
        label="I am"
        value={current}
        onChange={(member) =>
          startTransition(async () => {
            const res = await setMyMember(bookId, { member });
            toast(res.ok ? "Saved" : "Couldn't save", { status: res.ok ? "success" : "error", description: res.ok ? undefined : res.error });
          })
        }
        options={members.map((m) => ({ id: m, label: m }))}
        allowEmpty="Not a household member"
      />
      <p className="text-body-2-regular text-text-tertiary">{pending ? "Saving…" : "New transactions you add are tagged with this member."}</p>
    </div>
  );
}
