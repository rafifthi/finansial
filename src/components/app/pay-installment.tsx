"use client";

import { useState } from "react";
import { RiBankCardLine } from "@remixicon/react";
import { Button } from "@/components/base/buttons/button";
import type { FormOptions } from "@/lib/data/app-data";
import type { Installment } from "@/lib/sheets/schema";
import { useCan, useViewerMember } from "./permissions";
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
          account_id: installment.account_id,
          to_account_id: "",
          member: options.members.includes(member) ? member : "",
          description: installment.name,
          verified: false,
          installment_id: installment.id,
        }}
      />
    </>
  );
}
