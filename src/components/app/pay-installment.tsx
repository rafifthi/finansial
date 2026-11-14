"use client";

import { useState, useTransition } from "react";
import { RiBankCardLine, RiLinkM } from "@remixicon/react";
import { linkInstallmentPayments } from "@/actions/transactions";
import { Button } from "@/components/base/buttons/button";
import { toast } from "@/components/base/toast/toast";
import type { FormOptions } from "@/lib/data/app-data";
import type { Installment } from "@/lib/sheets/schema";
import { useBookId, useCan, useViewerMember } from "./permissions";
import { TransactionDrawer } from "./transaction-form";

/** Opens the transaction form pre-filled as this month's instalment payment. */
export function PayInstallmentButton({ installment, options }: { installment: Installment; options: FormOptions }) {
  const [open, setOpen] = useState(false);
  const member = useViewerMember();
  const canWrite = useCan("data:write");
  if (!canWrite) return null;
  return (
    <>
      <Button variant="primary" leadingIcon={RiBankCardLine} onClick={() => setOpen(true)} className="self-start">
        Record payment
      </Button>
      <TransactionDrawer
        options={options}
        isOpen={open}
        onOpenChange={setOpen}
        initial={{
          date: options.today,
          type: "expense",
          amount: installment.monthly_amount,
          category_id: installment.category_id,
          member: options.members.includes(member) ? member : "",
          description: installment.name,
          verified: false,
          installment_id: installment.id,
        }}
      />
    </>
  );
}

/** Links past expenses named like the installment that were saved before linking was automatic. */
export function LinkPaymentsButton({ installmentId, name, count }: { installmentId: string; name: string; count: number }) {
  const bookId = useBookId();
  const canWrite = useCan("data:write");
  const [pending, startTransition] = useTransition();
  if (!canWrite) return null;
  return (
    <Button
      variant="secondary"
      size="small"
      leadingIcon={RiLinkM}
      disabled={pending}
      className="self-start"
      onClick={() =>
        startTransition(async () => {
          const res = await linkInstallmentPayments(bookId, { installment_id: installmentId });
          if (!res.ok) return void toast("Couldn't link", { status: "error", description: res.error });
          toast(`Linked ${res.data?.count ?? count} ${res.data?.count === 1 ? "payment" : "payments"} to ${name}`, { status: "success" });
        })
      }
    >
      {pending ? "Linking…" : `Link ${count} ${count === 1 ? "payment" : "payments"}`}
    </Button>
  );
}
