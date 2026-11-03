"use client";

import { useState } from "react";
import { RiAddLine } from "@remixicon/react";
import { Button } from "@/components/base/buttons/button";
import type { FormOptions } from "@/lib/data/app-data";
import { useCan } from "./permissions";
import { TransactionDrawer } from "./transaction-form";

export function QuickAdd({ options }: { options: FormOptions }) {
  const [open, setOpen] = useState(false);
  if (!useCan("data:write")) return null;
  return (
    <>
      <Button variant="primary" leadingIcon={RiAddLine} onClick={() => setOpen(true)}>
        Add
      </Button>
      <TransactionDrawer options={options} isOpen={open} onOpenChange={setOpen} />
    </>
  );
}
