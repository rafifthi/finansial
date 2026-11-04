"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { RiErrorWarningLine } from "@remixicon/react";
import { Drawer, DrawerBody, DrawerHeader } from "@/components/base/drawer/drawer";
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
  destructive,
  error,
  children,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  onSubmit: () => void;
  /** The form's actions; the submit button goes last so it ends up nearest the thumb on phones. */
  footer: ReactNode;
  /** A delete or remove action. It sits apart from the primary actions, never at the bottom edge on phones. */
  destructive?: ReactNode;
  /** The form-level message. It stays in the sticky footer, so it's always on screen next to Save. */
  error?: string | null;
  children: ReactNode;
  className?: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [attempt, setAttempt] = useState(0);
  // After a submit (or when a server error first arrives), focus moves to the first field
  // marked invalid, so the problem is never off screen. Fixing fields never moves focus.
  const hasError = Boolean(error);
  useEffect(() => {
    if (!hasError) return;
    const first = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"], [data-invalid="true"]');
    if (!first) return;
    // A group (category tiles) takes focus on its first control.
    const target = first.matches("button, input, textarea, [tabindex]") ? first : first.querySelector<HTMLElement>("button, input");
    target?.focus({ preventScroll: true });
    first.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [attempt, hasError]);
  return (
    <form
      ref={formRef}
      // The form shows its own inline messages; the browser's bubbles would block onSubmit.
      noValidate
      className="flex min-h-0 flex-1 flex-col gap-4"
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        setAttempt((n) => n + 1);
        onSubmit();
      }}
      onKeyDown={(e: KeyboardEvent<HTMLFormElement>) => {
        // ⌘/Ctrl+Enter saves from anywhere, even from a select or the date button.
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          formRef.current?.requestSubmit();
        }
      }}
    >
      <DrawerHeader title={title} description={description} />
      <DrawerBody className={cx("flex flex-col gap-4", className)}>{children}</DrawerBody>
      <div className="mt-2 flex shrink-0 flex-col gap-3 px-6">
        <FormError>{error}</FormError>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          {destructive ? <div className="flex *:max-sm:h-11 sm:order-first">{destructive}</div> : <span className="hidden sm:block" />}
          <div className="flex flex-col-reverse gap-2 *:max-sm:h-11 sm:flex-row sm:items-center sm:justify-end">{footer}</div>
        </div>
      </div>
    </form>
  );
}

/** One line for the footer: the message itself, or a count when several fields need fixing. */
export function summarizeErrors(errors: Record<string, string | undefined>): string | null {
  const messages = Object.values(errors).filter(Boolean) as string[];
  if (messages.length === 0) return null;
  return messages.length === 1 ? messages[0] : `${messages.length} fields need attention.`;
}

export function FormError({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="flex items-start gap-2 rounded-xl bg-background-tertiary-error px-3 py-2 text-body-2-medium text-text-error-primary">
      <RiErrorWarningLine className="mt-px size-4 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}
