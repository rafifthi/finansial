/**
 * Downloads a square logo for every institution in lib/finance/institutions.ts
 * into public/logos/<id>.png, so the app serves them itself (no third-party
 * requests from users' browsers). Sources, in order:
 *   1. the App Store icon of its app (one batched iTunes lookup, 128×128 PNG)
 *   2. icons its homepage declares (apple-touch-icon, icon with sizes)
 *   3. /apple-touch-icon.png on the domain, then Google's favicon service
 * PNGs only; anything over 128px is scaled down with macOS `sips` when available.
 *
 *   pnpm logos:fetch            # only missing logos
 *   pnpm logos:fetch --force    # refetch everything
 *   pnpm logos:fetch --only jago,bca
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { INSTITUTIONS } from "@/lib/finance/institutions";

const OUT = path.join(process.cwd(), "public/logos");
const MIN = 64;
const TARGET = 128;
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36";

const args = process.argv.slice(2);
const force = args.includes("--force");
const only = args.includes("--only") ? args[args.indexOf("--only") + 1]?.split(",") : undefined;

async function get(url: string, timeoutMs = 10_000): Promise<Response | null> {
  try {
    const res = await fetch(url, { headers: { "user-agent": UA }, redirect: "follow", signal: AbortSignal.timeout(timeoutMs) });
    return res.ok ? res : null;
  } catch {
    return null;
  }
}

/** Width of a PNG from its IHDR chunk, or 0 when it isn't one. */
function pngWidth(buf: Buffer): number {
  const sig = buf.subarray(0, 8).toString("hex");
  return sig === "89504e470d0a1a0a" ? buf.readUInt32BE(16) : 0;
}

/** Icon URLs the homepage declares, biggest declared size first. */
async function declaredIcons(domain: string): Promise<string[]> {
  const res = (await get(`https://${domain}/`)) ?? (await get(`https://www.${domain}/`));
  if (!res) return [];
  const html = (await res.text()).slice(0, 300_000);
  const out: { href: string; size: number }[] = [];
  for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
    const rel = /rel=["']([^"']+)["']/i.exec(tag)?.[1].toLowerCase() ?? "";
    if (!/apple-touch-icon|(^|\s)icon/.test(rel)) continue;
    const href = /href=["']([^"']+)["']/i.exec(tag)?.[1];
    if (!href || href.startsWith("data:") || /\.svg(\?|$)/i.test(href)) continue;
    const size = Number(/sizes=["'](\d+)x/i.exec(tag)?.[1] ?? (rel.includes("apple") ? 180 : 32));
    out.push({ href: new URL(href, res.url).toString(), size });
  }
  return out.sort((a, b) => b.size - a.size).map((x) => x.href);
}

/** App Store id → 128px icon URL, from one lookup call (search is rate-limited, lookup isn't per app). */
async function appIcons(ids: number[]): Promise<Map<number, string>> {
  const out = new Map<number, string>();
  const res = await get(`https://itunes.apple.com/lookup?id=${ids.join(",")}&country=id&entity=software`, 30_000);
  if (!res) return out;
  const data = (await res.json()) as { results: { trackId: number; artworkUrl512?: string }[] };
  for (const r of data.results) {
    if (r.artworkUrl512) out.set(r.trackId, r.artworkUrl512.replace(/\/\d+x\d+bb\.\w+$/, `/${TARGET}x${TARGET}bb.png`));
  }
  return out;
}

async function best(domain: string, appIcon?: string): Promise<{ buf: Buffer; width: number; from: string } | null> {
  const candidates = [
    ...(appIcon ? [appIcon] : []),
    ...(await declaredIcons(domain)),
    `https://${domain}/apple-touch-icon.png`,
    `https://www.${domain}/apple-touch-icon.png`,
    `https://www.google.com/s2/favicons?domain=${domain}&sz=256`,
  ];
  let pick: { buf: Buffer; width: number; from: string } | null = null;
  for (const url of candidates) {
    const res = await get(url);
    if (!res) continue;
    const buf = Buffer.from(await res.arrayBuffer());
    const width = pngWidth(buf);
    if (width > (pick?.width ?? 0)) pick = { buf, width, from: url };
    if (width >= TARGET) break;
  }
  return pick;
}

function downscale(file: string, width: number) {
  if (width <= TARGET) return;
  try {
    execFileSync("sips", ["-Z", String(TARGET), file], { stdio: "ignore" });
  } catch {
    // Not on macOS: keep the original size.
  }
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const list = INSTITUTIONS.filter((i) => (!only || only.includes(i.id)) && (force || !existsSync(path.join(OUT, `${i.id}.png`))));
  const missing: string[] = [];
  const icons = await appIcons(list.map((i) => i.app));
  await Promise.all(
    list.map(async (i) => {
      const got = await best(i.domain, icons.get(i.app));
      if (!got || got.width < 16) {
        missing.push(`${i.id} (${i.domain})`);
        return;
      }
      const file = path.join(OUT, `${i.id}.png`);
      writeFileSync(file, got.buf);
      downscale(file, got.width);
      console.log(`${got.width < MIN ? "⚠ low-res" : "✓"} ${i.id.padEnd(12)} ${String(got.width).padStart(4)}px  ${got.from}`);
    }),
  );
  if (missing.length) console.log(`\nNo PNG found for: ${missing.join(", ")}. The app shows the account-type icon for these.`);
}

main();
