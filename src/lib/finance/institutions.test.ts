import { describe, expect, it } from "vitest";
import { detectInstitution, INSTITUTIONS, institutionOf } from "./institutions";

const detect = (name: string) => detectInstitution(name)?.id;

describe("detectInstitution", () => {
  it("finds the bank or app named in an account", () => {
    expect(detect("Jago")).toBe("jago");
    expect(detect("Jenius (personal)")).toBe("jenius");
    expect(detect("CC CIMB Niaga")).toBe("cimb");
    expect(detect("Tabungan BCA")).toBe("bca");
    expect(detect("GoPay")).toBe("gopay");
    expect(detect("Bank Mega")).toBe("mega");
    expect(detect("SeaBank")).toBe("seabank");
  });

  it("leaves everyday words alone unless they are the whole name", () => {
    expect(detect("Dana Darurat")).toBeUndefined();
    expect(detect("DANA")).toBe("dana");
    expect(detect("Pintu rumah")).toBeUndefined();
    expect(detect("Cash")).toBeUndefined();
  });

  it("matches whole words only", () => {
    expect(detect("Bribery fund")).toBeUndefined();
    expect(detect("Ovoid")).toBeUndefined();
  });
});

describe("institutionOf", () => {
  it("prefers the picked institution, and 'none' opts out", () => {
    expect(institutionOf({ name: "Jago", institution: "bca" })?.id).toBe("bca");
    expect(institutionOf({ name: "Jago", institution: "" })?.id).toBe("jago");
    expect(institutionOf({ name: "Jago", institution: "none" })).toBeUndefined();
  });

  it("has unique ids", () => {
    expect(new Set(INSTITUTIONS.map((i) => i.id)).size).toBe(INSTITUTIONS.length);
  });
});
