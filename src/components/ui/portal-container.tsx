"use client";

import { createContext, useContext } from "react";

/**
 * Where shadcn/ui (Radix) overlays portal to. Defaults to <body>. Inside a
 * BoardUI (React Aria) Modal or Drawer, everything outside the dialog is made
 * `inert`, so a menu portalled to <body> would draw but ignore taps. Wrap the
 * dialog's content in `<PortalContainer value={element}>` to keep them inside it.
 */
export const PortalContainer = createContext<HTMLElement | null>(null);

export const usePortalContainer = () => useContext(PortalContainer) ?? undefined;
