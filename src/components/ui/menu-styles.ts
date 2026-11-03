/**
 * BoardUI skin for the shadcn/ui menus (dropdown-menu, context-menu). The
 * components keep shadcn's structure and Radix behaviour; every visual comes
 * from BoardUI tokens so they match the rest of the app, dark mode and the
 * glass setting. Motion lives in styles/app.css (`[data-slot$="menu-content"]`).
 */
export const MENU_CONTENT =
  "glass glass-raised z-110 min-w-40 overflow-x-hidden overflow-y-auto rounded-2xl border border-border-button-default bg-background-primary-default p-1.5 text-text-primary shadow-dropdown outline-none";

export const MENU_ITEM = [
  "relative flex cursor-pointer items-center gap-2 rounded-2lg px-2 py-2 text-body-medium text-text-primary outline-none select-none transition-colors",
  "data-[highlighted]:bg-dropdown-item-hover-background",
  "data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[inset]:ps-8",
  "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-foreground-icon-secondary",
  "data-[variant=destructive]:text-text-error-primary data-[variant=destructive]:[&_svg]:text-text-error-primary",
].join(" ");

export const MENU_LABEL = "px-2 py-1.5 text-body-2-regular text-text-tertiary data-[inset]:ps-8";

export const MENU_SEPARATOR = "-mx-1.5 my-1.5 h-px bg-separator-border";

export const MENU_SHORTCUT = "ms-auto text-caption-1-regular text-text-tertiary";

/** Check / radio rows reserve the start gutter for their indicator. */
export const MENU_INDICATOR_ITEM = `${MENU_ITEM} ps-8`;
export const MENU_INDICATOR = "pointer-events-none absolute start-2 flex size-4 items-center justify-center";
