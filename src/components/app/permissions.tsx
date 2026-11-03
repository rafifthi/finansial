"use client";

import { createContext, useContext, type ReactNode } from "react";
import { can, type Permission, type Role } from "@/lib/auth/roles";

export interface BookViewer {
  bookId: string;
  bookName: string;
  bookKind: "family" | "personal";
  /** The signed-in user's role in this book. */
  role: Role;
  /** Household member linked to this login in this book, the default on new transactions. */
  member: string;
}

const ViewerContext = createContext<BookViewer | null>(null);

/**
 * Makes the current book and the user's role in it available to client
 * components. Display only; the server enforces every permission.
 */
export function PermissionsProvider({ children, ...viewer }: BookViewer & { children: ReactNode }) {
  return <ViewerContext.Provider value={viewer}>{children}</ViewerContext.Provider>;
}

export function useCan(permission: Permission): boolean {
  return can(useContext(ViewerContext)?.role, permission);
}

export function useViewerMember(): string {
  return useContext(ViewerContext)?.member ?? "";
}

/** The current book's id; every book-scoped server action takes it first. */
export function useBookId(): string {
  const v = useContext(ViewerContext);
  if (!v) throw new Error("useBookId() used outside a book page.");
  return v.bookId;
}

/** Prefixes an in-book path with the current book: "/budget" → "/b/<id>/budget". */
export function useBookHref(): (path?: string) => string {
  const id = useContext(ViewerContext)?.bookId;
  return (path = "") => (id ? `/b/${id}${path}` : path || "/");
}
