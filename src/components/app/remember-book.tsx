"use client";

import { useEffect } from "react";

export const LAST_BOOK_COOKIE = "finansial_book";

/** Remembers the open book so "/" can return to it (a convenience; membership is re-checked server-side). */
export function RememberBook({ bookId }: { bookId: string }) {
  useEffect(() => {
    document.cookie = `${LAST_BOOK_COOKIE}=${encodeURIComponent(bookId)}; path=/; max-age=31536000; samesite=lax`;
  }, [bookId]);
  return null;
}
