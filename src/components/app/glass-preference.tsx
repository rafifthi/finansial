"use client";

import { useSyncExternalStore } from "react";
import { Slider } from "@/components/base/slider/slider";

const STORAGE_KEY = "finansial:glass";
export const DEFAULT_GLASS = 60;

function readStored(): number {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v !== null) return Math.min(Math.max(Number(v), 0), 100);
    return matchMedia("(prefers-reduced-transparency: reduce)").matches ? 0 : DEFAULT_GLASS;
  } catch {
    return DEFAULT_GLASS;
  }
}

const CHANGE_EVENT = "finansial:glass-change";

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function store(level: number) {
  document.documentElement.style.setProperty("--glass", String(level / 100));
  try {
    localStorage.setItem(STORAGE_KEY, String(level));
  } catch {
    // Still applies for this visit when storage is blocked.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

const describe = (v: number) => (v === 0 ? "Off — solid surfaces" : v < 35 ? "Subtle" : v < 70 ? "Balanced" : "Strong");

/**
 * Per-device glass intensity (0–100). Applied live through the --glass CSS
 * variable; the root layout re-applies it before first paint on every load.
 */
export function GlassPreference() {
  // null on the server: localStorage only exists in the browser.
  const level = useSyncExternalStore(subscribe, readStored, () => null);
  const change = store;

  return (
    <div className="flex flex-col gap-3">
      <Slider
        label="Glass effect"
        thumbLabel="Glass intensity"
        minValue={0}
        maxValue={100}
        step={5}
        value={level ?? DEFAULT_GLASS}
        onChange={change}
        isDisabled={level === null}
        formatValue={(v) => `${v}%`}
      />
      <div className="flex items-center justify-between gap-3 text-body-2-regular text-text-tertiary">
        <span>{describe(level ?? DEFAULT_GLASS)}. Saved on this device only.</span>
        {level !== DEFAULT_GLASS && level !== null ? (
          <button type="button" onClick={() => change(DEFAULT_GLASS)} className="rounded-md text-body-2-medium text-accent-600 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-border-focus-ring dark:text-accent-400">
            Reset
          </button>
        ) : null}
      </div>
    </div>
  );
}
