"use client";

import { useSyncExternalStore } from "react";
import { SegmentedControl, SegmentedControlItem } from "@/components/base/segmented-control/segmented-control";
import {
  readThemePreference,
  setThemePreference,
  THEME_CHANGE_EVENT,
  THEME_STORAGE_KEY,
  type ThemePreference as Pref,
} from "@/components/application/theme/theme-toggle";

function subscribe(onChange: () => void) {
  const onStorage = (e: StorageEvent) => e.key === THEME_STORAGE_KEY && onChange();
  window.addEventListener(THEME_CHANGE_EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(THEME_CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

/** System (default), Light or Dark for this device. */
export function ThemePreference() {
  const pref = useSyncExternalStore(subscribe, readThemePreference, () => "system" as Pref);
  return (
    <div className="flex flex-col gap-1.5">
      <span id="theme-pref-label" className="text-body-medium text-text-primary">
        Theme
      </span>
      <SegmentedControl
        aria-labelledby="theme-pref-label"
        selectedKeys={[pref]}
        onSelectionChange={(keys) => {
          const next = [...keys][0];
          if (next) setThemePreference(String(next) as Pref);
        }}
      >
        <SegmentedControlItem id="system">System</SegmentedControlItem>
        <SegmentedControlItem id="light">Light</SegmentedControlItem>
        <SegmentedControlItem id="dark">Dark</SegmentedControlItem>
      </SegmentedControl>
      <span className="text-body-2-regular text-text-tertiary">
        {pref === "system" ? "Follows your device’s light or dark setting." : "Always this theme on this device."}
      </span>
    </div>
  );
}
