"use client";

import type { ReactNode, Ref } from "react";
import type { RemixiconComponentType } from "@remixicon/react";
import { cx } from "@/utils/cx";

/**
 * The quick-set chip used for deadlines, repeats and priorities: in the new
 * item composer and in the item menu. Pressed reads as selected.
 */
export function Pill({
  pressed,
  onPress,
  icon: Icon,
  label,
  children,
  className,
  ref,
}: {
  pressed?: boolean;
  onPress: () => void;
  icon?: RemixiconComponentType;
  /** Accessible name when the chip shows only an icon. */
  label?: string;
  children?: ReactNode;
  className?: string;
  ref?: Ref<HTMLButtonElement>;
}) {
  return (
    <button
      ref={ref}
      type="button"
      aria-pressed={pressed}
      aria-label={label}
      title={label}
      onClick={onPress}
      className={cx(
        "inline-flex h-7 shrink-0 cursor-pointer items-center justify-center gap-1 rounded-full border px-2 text-body-2-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-border-focus-ring max-sm:h-9",
        !children && "w-7 px-0 max-sm:w-9",
        pressed
          ? "border-transparent bg-pill-tab-blue-selected-background text-text-primary"
          : "border-border-button-default text-text-secondary hover:border-border-button-hover hover:bg-background-secondary-hover hover:text-text-primary",
        className,
      )}
    >
      {Icon ? <Icon className="size-3.5 shrink-0" aria-hidden /> : null}
      {children}
    </button>
  );
}
