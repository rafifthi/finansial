import { describe, expect, it } from "vitest";
import { columnLetter, decodeRows, encodeRow, serialToIsoDate, toIsoDate } from "./codec";
import { TABLES } from "./schema";

describe("codec", () => {
  it("converts sheet serial dates", () => {
    expect(serialToIsoDate(46296)).toBe("2026-10-01");
    expect(toIsoDate("01 Oct 2026")).toBe("2026-10-01");
    expect(toIsoDate("2026-10-01 08:00")).toBe("2026-10-01");
  });

  it("maps by header name regardless of order and skips blank rows", () => {
    const values = [
      ["Amount", "id", "my notes", "date", "type", "verified"],
      ["Rp13,000", "t1", "keep me", 46296, "expense", "TRUE"],
      ["", "", "", "", "", ""],
      [5, "t2", "", "2026-10-02", "nonsense", false],
    ];
    const { rows, errors } = decodeRows(TABLES.transactions, values);
    expect(rows).toHaveLength(1);
    expect(rows[0].rowNumber).toBe(2);
    expect(rows[0].data).toMatchObject({ id: "t1", amount: 13000, date: "2026-10-01", verified: true, category_id: "" });
    expect(errors).toEqual([{ rowNumber: 4, message: expect.stringContaining("type") }]);
  });

  it("encodes in sheet order and preserves unknown columns", () => {
    const headers = ["amount", "id", "my notes", "date"];
    const out = encodeRow(TABLES.transactions, headers, { id: "t1", amount: 99, date: "2026-10-01" }, [1, "t1", "keep me", "x"]);
    expect(out).toEqual([99, "t1", "keep me", "2026-10-01"]);
  });

  it("column letters", () => {
    expect([0, 25, 26, 51, 701].map(columnLetter)).toEqual(["A", "Z", "AA", "AZ", "ZZ"]);
  });
});
