import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { keyHint, openSecret, sealSecret } = await import("./live-key");

describe("live cursors key", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("seals the key so the sheet never holds it in the clear", () => {
    vi.stubEnv("AUTH_SECRET", "test-secret");
    const sealed = sealSecret("sk_prod_abc123");
    expect(sealed).not.toContain("abc123");
    expect(openSecret(sealed)).toBe("sk_prod_abc123");
  });

  it("reads nothing back once AUTH_SECRET changes or the cell is edited", () => {
    vi.stubEnv("AUTH_SECRET", "one");
    const sealed = sealSecret("sk_prod_abc123");
    vi.stubEnv("AUTH_SECRET", "two");
    expect(openSecret(sealed)).toBe("");
    expect(openSecret("sk_prod_typed_by_hand")).toBe("");
  });

  it("shows only the ends of the key", () => {
    expect(keyHint("sk_prod_abcdef1234")).toBe("sk_…1234");
  });
});
