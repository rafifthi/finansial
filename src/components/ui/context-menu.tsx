"use client";

/**
 * shadcn/ui ContextMenu (Radix), restyled with BoardUI tokens. Opens on
 * right-click, and on long-press with touch.
 * Source: https://ui.shadcn.com/docs/components/context-menu
 * Kept: structure, data-slot names, props (`inset`, `variant`). Changed:
 * classes (see ./menu-styles.ts), `cx` instead of `cn`, Remix icons instead of lucide.
 */
import type { ComponentProps } from "react";
import { RiArrowRightSLine, RiCheckLine, RiCircleFill } from "@remixicon/react";
import { ContextMenu as ContextMenuPrimitive } from "radix-ui";
import { cx } from "@/utils/cx";
import { usePortalContainer } from "./portal-container";
import { MENU_CONTENT, MENU_INDICATOR, MENU_INDICATOR_ITEM, MENU_ITEM, MENU_LABEL, MENU_SEPARATOR, MENU_SHORTCUT } from "./menu-styles";

function ContextMenu(props: ComponentProps<typeof ContextMenuPrimitive.Root>) {
  return <ContextMenuPrimitive.Root data-slot="context-menu" {...props} />;
}

function ContextMenuTrigger(props: ComponentProps<typeof ContextMenuPrimitive.Trigger>) {
  return <ContextMenuPrimitive.Trigger data-slot="context-menu-trigger" {...props} />;
}

function ContextMenuGroup(props: ComponentProps<typeof ContextMenuPrimitive.Group>) {
  return <ContextMenuPrimitive.Group data-slot="context-menu-group" {...props} />;
}

function ContextMenuPortal(props: ComponentProps<typeof ContextMenuPrimitive.Portal>) {
  return <ContextMenuPrimitive.Portal data-slot="context-menu-portal" {...props} />;
}

function ContextMenuSub(props: ComponentProps<typeof ContextMenuPrimitive.Sub>) {
  return <ContextMenuPrimitive.Sub data-slot="context-menu-sub" {...props} />;
}

function ContextMenuRadioGroup(props: ComponentProps<typeof ContextMenuPrimitive.RadioGroup>) {
  return <ContextMenuPrimitive.RadioGroup data-slot="context-menu-radio-group" {...props} />;
}

function ContextMenuSubTrigger({
  className,
  inset,
  children,
  ...props
}: ComponentProps<typeof ContextMenuPrimitive.SubTrigger> & { inset?: boolean }) {
  return (
    <ContextMenuPrimitive.SubTrigger
      data-slot="context-menu-sub-trigger"
      data-inset={inset}
      className={cx(MENU_ITEM, "data-[state=open]:bg-dropdown-item-hover-background", className)}
      {...props}
    >
      {children}
      <RiArrowRightSLine className="ms-auto size-4 rtl:-scale-x-100" />
    </ContextMenuPrimitive.SubTrigger>
  );
}

function ContextMenuSubContent({ className, ...props }: ComponentProps<typeof ContextMenuPrimitive.SubContent>) {
  return (
    <ContextMenuPrimitive.SubContent
      data-slot="context-menu-sub-content"
      className={cx(MENU_CONTENT, "origin-(--radix-context-menu-content-transform-origin)", className)}
      {...props}
    />
  );
}

function ContextMenuContent({ className, ...props }: ComponentProps<typeof ContextMenuPrimitive.Content>) {
  const container = usePortalContainer();
  return (
    <ContextMenuPrimitive.Portal container={container}>
      <ContextMenuPrimitive.Content
        data-slot="context-menu-content"
        className={cx(
          MENU_CONTENT,
          "max-h-(--radix-context-menu-content-available-height) origin-(--radix-context-menu-content-transform-origin)",
          className,
        )}
        {...props}
      />
    </ContextMenuPrimitive.Portal>
  );
}

function ContextMenuItem({
  className,
  inset,
  variant = "default",
  ...props
}: ComponentProps<typeof ContextMenuPrimitive.Item> & { inset?: boolean; variant?: "default" | "destructive" }) {
  return (
    <ContextMenuPrimitive.Item
      data-slot="context-menu-item"
      data-inset={inset}
      data-variant={variant}
      className={cx(MENU_ITEM, className)}
      {...props}
    />
  );
}

function ContextMenuCheckboxItem({ className, children, checked, ...props }: ComponentProps<typeof ContextMenuPrimitive.CheckboxItem>) {
  return (
    <ContextMenuPrimitive.CheckboxItem
      data-slot="context-menu-checkbox-item"
      className={cx(MENU_INDICATOR_ITEM, className)}
      checked={checked}
      {...props}
    >
      <span className={MENU_INDICATOR}>
        <ContextMenuPrimitive.ItemIndicator>
          <RiCheckLine className="size-4 text-accent-500" />
        </ContextMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </ContextMenuPrimitive.CheckboxItem>
  );
}

function ContextMenuRadioItem({ className, children, ...props }: ComponentProps<typeof ContextMenuPrimitive.RadioItem>) {
  return (
    <ContextMenuPrimitive.RadioItem data-slot="context-menu-radio-item" className={cx(MENU_INDICATOR_ITEM, className)} {...props}>
      <span className={MENU_INDICATOR}>
        <ContextMenuPrimitive.ItemIndicator>
          <RiCircleFill className="size-2 text-accent-500" />
        </ContextMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </ContextMenuPrimitive.RadioItem>
  );
}

function ContextMenuLabel({ className, inset, ...props }: ComponentProps<typeof ContextMenuPrimitive.Label> & { inset?: boolean }) {
  return <ContextMenuPrimitive.Label data-slot="context-menu-label" data-inset={inset} className={cx(MENU_LABEL, className)} {...props} />;
}

function ContextMenuSeparator({ className, ...props }: ComponentProps<typeof ContextMenuPrimitive.Separator>) {
  return <ContextMenuPrimitive.Separator data-slot="context-menu-separator" className={cx(MENU_SEPARATOR, className)} {...props} />;
}

function ContextMenuShortcut({ className, ...props }: ComponentProps<"span">) {
  return <span data-slot="context-menu-shortcut" className={cx(MENU_SHORTCUT, className)} {...props} />;
}

export {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuCheckboxItem,
  ContextMenuRadioItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuGroup,
  ContextMenuPortal,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuRadioGroup,
};
