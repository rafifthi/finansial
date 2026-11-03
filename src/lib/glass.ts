/**
 * The Appearance → Glass effect setting: one per-device level (0–100) that
 * every glass surface reads through the --glass CSS variable (styles/app.css).
 * Shared by the pre-paint boot script and the Settings slider so both apply
 * it the same way.
 */
export const GLASS_STORAGE_KEY = "finansial:glass";
export const GLASS_CHANGE_EVENT = "finansial:glass-change";
export const DEFAULT_GLASS = 60;
export const REDUCED_TRANSPARENCY = "(prefers-reduced-transparency: reduce)";

export const clampGlass = (n: number) => (Number.isFinite(n) ? Math.min(Math.max(Math.round(n), 0), 100) : DEFAULT_GLASS);

/**
 * Writes a level onto <html>: --glass for the surfaces, and data-glass="off"
 * at 0 so surfaces drop backdrop-filter entirely (truly solid, nothing to composite).
 * Inlined into the boot script via toString(), so it must stay self-contained.
 */
export function applyGlassLevel(level: number) {
  const root = document.documentElement;
  root.style.setProperty("--glass", String(level / 100));
  root.dataset.glass = level === 0 ? "off" : "on";
}

/** Runs in <head> before first paint (no flash of the wrong level). */
export const glassBootScript = `try{var g=localStorage.getItem(${JSON.stringify(GLASS_STORAGE_KEY)});g=g===null?${DEFAULT_GLASS}:Math.min(Math.max(Math.round(Number(g))||0,0),100);(${applyGlassLevel.toString()})(g)}catch(e){}`;
