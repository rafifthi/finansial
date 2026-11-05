import { cx } from "@/utils/cx";

/**
 * The Finansial mark: two joined loops (lime) on a forest tile, the two greens
 * of the accent. It stays forest + lime in both themes. Same drawing as
 * app/icon.svg (favicon and home-screen icons); keep them in step.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cx("flex size-8 shrink-0 items-center justify-center rounded-xl bg-accent-700", className)}>
      <svg viewBox="80 168 352 176" className="w-3/4 text-accent-300" aria-hidden>
        <path
          d="M256 216C232 216 214 184 174 184A72 72 0 0 0 174 328C214 328 232 296 256 296C280 296 298 328 338 328A72 72 0 0 0 338 184C298 184 280 216 256 216Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="32"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}
