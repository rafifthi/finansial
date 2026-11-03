"use client";

import { Toaster } from "@/components/base/toast/toast";
import { useIsMobile } from "./use-is-mobile";

/** Toasts sit at the top on phones so they never cover the bottom tab bar. */
export function AppToaster() {
  return <Toaster position={useIsMobile() ? "top-center" : "bottom-end"} />;
}
