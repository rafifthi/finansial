"use client";

import type { FormEvent, ReactNode } from "react";
import { Drawer, DrawerBody, DrawerFooter, DrawerHeader } from "@/components/base/drawer/drawer";
import { cx } from "@/utils/cx";
import { useIsMobile } from "./use-is-mobile";

/**
 * The one container for every form in the app: a right-side drawer on
 * desktop and a bottom sheet on phones. Clicking outside, Escape and the close
 * button all dismiss it. The overlay unmounts its content after closing, so
 * every open starts fresh.
 */
export function FormDrawer({
  isOpen,
  onOpenChange,
  "aria-label": ariaLabel,
  size = "md",
  children,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  "aria-label": string;
  size?: "sm" | "md" | "lg";
  children: ReactNode;
}) {
  const mobile = useIsMobile();
  return (
    <Drawer
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      isDismissable
      shouldCloseOnInteractOutside={isOutsideDrawer}
      placement={mobile ? "bottom" : "end"}
      size={size}
      aria-label={ariaLabel}
      overlayClassName={mobile ? "p-0 pt-10" : undefined}
      className={cx("glass glass-full", mobile && "rounded-b-none pb-[max(1.5rem,env(safe-area-inset-bottom))]")}
    >
      {children}
    </Drawer>
  );
}

/**
 * BoardUI selects and date pickers render their listbox/calendar in a popover
 * portalled outside the drawer; presses there must not count as "outside".
 */
export function isOutsideDrawer(element: Element): boolean {
  return !element.closest('[data-trigger], [role="listbox"], [role="option"], [role="dialog"], [role="grid"]');
}

/** Header, scrolling body and sticky footer of a drawer form. */
export function DrawerForm({
  title,
  description,
  onSubmit,
  footer,
  children,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  onSubmit: () => void;
  /** Usually the submit button, plus a destructive action on the start side. */
  footer: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <form
      className="flex min-h-0 flex-1 flex-col gap-4"
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <DrawerHeader title={title} description={description} />
      <DrawerBody className={cx("flex flex-col gap-4", className)}>{children}</DrawerBody>
      <DrawerFooter className="sm:justify-between">{footer}</DrawerFooter>
    </form>
  );
}

export function FormError({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="text-body-2-regular text-text-error-primary">
      {children}
    </p>
  );
}
