import { randomBytes, scrypt, scryptSync, timingSafeEqual, type ScryptOptions } from "node:crypto";
import { MIN_PASSWORD_LENGTH } from "./constants";

/**
 * Password hashing with Node's built-in scrypt (no native deps). Stored as
 * `scrypt$N$r$p$<salt b64>$<hash b64>` so parameters can be raised later
 * without breaking existing hashes.
 */
const PARAMS = { N: 16384, r: 8, p: 1 };
const KEY_LEN = 32;

export { MIN_PASSWORD_LENGTH } from "./constants";

function derive(password: string, salt: Buffer, opts: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(password.normalize("NFKC"), salt, KEY_LEN, { ...opts, maxmem: 64 * 1024 * 1024 }, (err, key) =>
      err ? reject(err) : resolve(key),
    ),
  );
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt, PARAMS);
  return ["scrypt", PARAMS.N, PARAMS.r, PARAMS.p, salt.toString("base64"), key.toString("base64")].join("$");
}

/** Synchronous variant, only for seeding the in-memory demo database. */
export function hashPasswordSync(password: string): string {
  const salt = randomBytes(16);
  const key = scryptSync(password.normalize("NFKC"), salt, KEY_LEN, { ...PARAMS, maxmem: 64 * 1024 * 1024 });
  return ["scrypt", PARAMS.N, PARAMS.r, PARAMS.p, salt.toString("base64"), key.toString("base64")].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [alg, n, r, p, salt, hash] = stored.split("$");
  if (alg !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64");
  const key = await derive(password, Buffer.from(salt, "base64"), { N: Number(n), r: Number(r), p: Number(p) });
  return key.length === expected.length && timingSafeEqual(key, expected);
}

/** Readable temporary password, e.g. "kemiri-7421-tapis". */
export function temporaryPassword(): string {
  const words = ["kopi", "teh", "nasi", "sambal", "kemiri", "pandan", "tapis", "batik", "angklung", "rendang", "salak", "durian"];
  const pick = () => words[randomBytes(1)[0] % words.length];
  return `${pick()}-${1000 + (randomBytes(2).readUInt16BE() % 9000)}-${pick()}`;
}

export function passwordProblem(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  if (password.length > 200) return "That password is too long.";
  return null;
}
