import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import type { BookStore } from "@/lib/data/store";

/**
 * The Liveblocks secret key for live cursors. An admin can paste it in the
 * book's Settings; it's kept in the Settings tab sealed with AUTH_SECRET
 * (AES-256-GCM), so the sheet never shows it in the clear and it never goes
 * back to the browser. LIVEBLOCKS_SECRET_KEY on the server is the fallback.
 */
export const LIVE_KEY_SETTING = "liveblocks_secret";

function cipherKey(): Buffer {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET isn't set on the server, so the key can't be stored safely.");
  return createHash("sha256").update(`${secret}:book-secrets`).digest();
}

export function sealSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", cipherKey(), iv);
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), body.toString("base64url")].join(":");
}

/** The key, or "" when it's missing or was sealed with a different AUTH_SECRET. */
export function openSecret(sealed: string): string {
  const [v, iv, tag, body] = sealed.split(":");
  if (v !== "v1" || !iv || !tag || !body) return "";
  try {
    const decipher = createDecipheriv("aes-256-gcm", cipherKey(), Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(body, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    return "";
  }
}

export type LiveKeySource = "book" | "server" | "none";

/** Which key live cursors use for this book, and where it came from. */
export async function liveKey(store: BookStore): Promise<{ key: string; source: LiveKeySource }> {
  const sealed = (await store.settings())[LIVE_KEY_SETTING] ?? "";
  const own = sealed ? openSecret(sealed) : "";
  if (own) return { key: own, source: "book" };
  const env = process.env.LIVEBLOCKS_SECRET_KEY ?? "";
  return env ? { key: env, source: "server" } : { key: "", source: "none" };
}

/** "sk_…a1b2": enough to recognise the key without showing it. */
export const keyHint = (key: string) => (key ? `${key.slice(0, 3)}…${key.slice(-4)}` : "");
