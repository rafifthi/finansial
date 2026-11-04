import { cx } from "@/utils/cx";

/**
 * The Finansial mark: a roof over rising bars, on the accent tile. Same
 * drawing as app/icon.svg (favicon, home-screen icons); keep them in step.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cx("flex size-8 shrink-0 items-center justify-center rounded-xl bg-linear-to-b from-accent-400 to-accent-600 text-white", className)}>
      <svg viewBox="96 116 320 292" className="size-3/5" aria-hidden>
        <path d="M112 244 256 132l144 112" fill="none" stroke="currentColor" strokeWidth="46" strokeLinecap="round" strokeLinejoin="round" />
        <g fill="currentColor">
          <rect x="159" y="312" width="50" height="80" rx="25" fillOpacity=".6" />
          <rect x="231" y="276" width="50" height="116" rx="25" fillOpacity=".8" />
          <rect x="303" y="244" width="50" height="148" rx="25" />
        </g>
      </svg>
    </span>
  );
}
