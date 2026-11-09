"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
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
  const [librarySlot, setLibrarySlot] = useState<HTMLElement | null>(null);
  return (
    <ShellContext.Provider value={value}>
      <NavSlotContext.Provider value={{ librarySlot, setLibrarySlot }}>{children}</NavSlotContext.Provider>
    </ShellContext.Provider>
  );
}

interface NavSlot {
  /** The spot under the sidebar's Library row where the Library section draws its page tree. */
  librarySlot: HTMLElement | null;
  setLibrarySlot: (el: HTMLElement | null) => void;
}

const NavSlotContext = createContext<NavSlot>({ librarySlot: null, setLibrarySlot: () => {} });

/** Lets a section render navigation inside the sidebar (via a portal) without the sidebar knowing its data. */
export function useNavSlot(): NavSlot {
  return useContext(NavSlotContext);
}

export function useShell(): ShellValue {
  const value = useContext(ShellContext);
  if (!value) throw new Error("useShell must be used inside AppShell");
  return value;
}
