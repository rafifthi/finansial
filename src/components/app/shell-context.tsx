"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { ShellBook } from "./book-switcher";

export interface ShellUser {
  name: string;
  email: string;
  isSystemAdmin: boolean;
}

export interface ShellValue {
  user: ShellUser;
  books: ShellBook[];
  /** The open book, or none on account pages (profile, books, admin). */
  current?: ShellBook;
  badges: { unverified?: number };
  signOutAction: () => Promise<void>;
}

const ShellContext = createContext<ShellValue | null>(null);

/** What the shell knows (user, books, badges), for pages that render navigation themselves. */
export function ShellProvider({ children, ...value }: ShellValue & { children: ReactNode }) {
  return <ShellContext.Provider value={value}>{children}</ShellContext.Provider>;
}

export function useShell(): ShellValue {
  const value = useContext(ShellContext);
  if (!value) throw new Error("useShell must be used inside AppShell");
  return value;
}
