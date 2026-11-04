"use client";

import { useSyncExternalStore } from "react";
import { START_PAGE_COOKIE, START_PAGES, type StartPage } from "@/lib/start-page";
import { SelectField } from "./fields";

const CHANGE_EVENT = "finansial:start-page-change";

function read(): StartPage {
  const match = document.cookie.match(new RegExp(`(?:^|; )${START_PAGE_COOKIE}=([^;]*)`));
  const value = match ? decodeURIComponent(match[1]) : "";
  return START_PAGES.find((p) => p.id === value)?.id ?? "dashboard";
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => window.removeEventListener(CHANGE_EVENT, onChange);
}

function store(value: string) {
  document.cookie = `${START_PAGE_COOKIE}=${encodeURIComponent(value || "dashboard")}; path=/; max-age=31536000; samesite=lax`;
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** Which page opening the app lands on, for this device. */
export function StartPagePreference() {
  // null on the server: the cookie is read in the browser.
  const value = useSyncExternalStore(subscribe, read, () => null);
  return (
    <div className="flex flex-col gap-1">
      <SelectField
        label="Starting page"
        value={value ?? "dashboard"}
        onChange={store}
        options={START_PAGES.map((p) => ({ id: p.id, label: p.label }))}
      />
      <span className="text-body-2-regular text-text-tertiary">Where the app opens, in your last-used book.</span>
    </div>
  );
}
