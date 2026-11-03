import Image from "next/image";
import {
  type RemixiconComponentType,
  RiBankCardLine,
  RiBankLine,
  RiLineChartLine,
  RiMoneyDollarCircleLine,
  RiWallet3Line,
} from "@remixicon/react";
import { institutionLogo, institutionOf } from "@/lib/finance/institutions";
import type { Account } from "@/lib/sheets/schema";
import { cx } from "@/utils/cx";

const TYPE_ICON: Record<Account["type"], RemixiconComponentType> = {
  bank: RiBankLine,
  ewallet: RiWallet3Line,
  cash: RiMoneyDollarCircleLine,
  credit_card: RiBankCardLine,
  investment: RiLineChartLine,
};

const SIZES = {
  sm: { box: "size-7 rounded-lg", px: 28, icon: "size-3.5" },
  md: { box: "size-9 rounded-xl", px: 36, icon: "size-4" },
  lg: { box: "size-12 rounded-2xl", px: 48, icon: "size-5" },
};

/**
 * An account's bank or app logo (its app icon, from public/logos), else an
 * icon for its type. Same tile sizes as CategoryIcon so they line up.
 */
export function AccountLogo({
  account,
  size = "md",
  className,
}: {
  account: Pick<Account, "name" | "institution" | "type">;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const s = SIZES[size];
  const inst = institutionOf(account);
  if (inst) {
    return (
      <span className={cx("inline-flex shrink-0 overflow-hidden border border-separator-border", s.box, className)}>
        <Image src={institutionLogo(inst)} alt="" width={s.px} height={s.px} className="size-full object-cover" />
      </span>
    );
  }
  const Icon = TYPE_ICON[account.type] ?? RiBankLine;
  return (
    <span
      aria-hidden
      className={cx(
        "inline-flex shrink-0 items-center justify-center bg-background-tertiary-default text-foreground-icon-secondary",
        s.box,
        className,
      )}
    >
      <Icon className={s.icon} />
    </span>
  );
}
