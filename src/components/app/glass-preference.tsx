"use client";

import { useEffect, useSyncExternalStore } from "react";
import { Slider } from "@/components/base/slider/slider";
import {
  applyGlassLevel,
  clampGlass,
  DEFAULT_GLASS,
  GLASS_CHANGE_EVENT,
  GLASS_STORAGE_KEY,
  REDUCED_TRANSPARENCY,
} from "@/lib/glass";

function readStored(): number {
  try {
    const v = localStorage.getItem(GLASS_STORAGE_KEY);
    return v === null ? DEFAULT_GLASS : clampGlass(Number(v));
  } catch {
    return DEFAULT_GLASS;
  }
}

function subscribeLevel(onChange: () => void) {
  window.addEventListener(GLASS_CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(GLASS_CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function subscribeReduced(onChange: () => void) {
  const mq = matchMedia(REDUCED_TRANSPARENCY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

function store(level: number) {
  applyGlassLevel(level);
  try {
    localStorage.setItem(GLASS_STORAGE_KEY, String(level));
  } catch {
    // Still applies for this visit when storage is blocked.
  }
  window.dispatchEvent(new Event(GLASS_CHANGE_EVENT));
}

const describe = (v: number) => (v === 0 ? "Off — solid surfaces" : v < 35 ? "Subtle" : v < 70 ? "Balanced" : "Strong");

/**
 * Per-device glass intensity (0–100), applied live through --glass. The
 * system's Reduce transparency wins over it (styles/app.css), and the
 * control says so rather than pretending to work.
 */
export function GlassPreference() {
  // null on the server: localStorage and matchMedia only exist in the browser.
  const level = useSyncExternalStore(subscribeLevel, readStored, () => null);
  const reduced = useSyncExternalStore(subscribeReduced, () => matchMedia(REDUCED_TRANSPARENCY).matches, () => false);

  // A change saved in another tab arrives as a storage event; repaint this one too.
  useEffect(() => {
    const sync = (e: StorageEvent) => {
      if (e.key === GLASS_STORAGE_KEY || e.key === null) applyGlassLevel(readStored());
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  const value = level ?? DEFAULT_GLASS;
  return (
    <div className="flex flex-col gap-3">
      <Slider
        label="Glass effect"
        thumbLabel="Glass intensity"
        minValue={0}
        maxValue={100}
        step={5}
        value={reduced ? 0 : value}
        onChange={store}
        isDisabled={level === null || reduced}
        formatValue={(v) => `${v}%`}
      />
      <div className="flex items-center justify-between gap-3 text-body-2-regular text-text-tertiary">
        <span>
          {reduced
            ? "Off while your device's Reduce transparency setting is on."
            : `${describe(value)}. Saved on this device only.`}
        </span>
        {!reduced && level !== null && level !== DEFAULT_GLASS ? (
          <button
            type="button"
            onClick={() => store(DEFAULT_GLASS)}
            className="rounded-md text-body-2-medium text-button-ghost-foreground outline-none hover:underline focus-visible:ring-2 focus-visible:ring-border-focus-ring"
          >
            Reset
          </button>
        ) : null}
      </div>
    </div>
  );
}
