import { describe, expect, it } from "vitest";
import { orderCategories, rearrange } from "./schema";

describe("category order", () => {
  it("sorts by position, keeping sheet order for ties and unset rows", () => {
    const rows = [
      { id: "a", position: 0 },
      { id: "b", position: 0 },
      { id: "c", position: 0 },
    ];
    expect(orderCategories(rows).map((r) => r.id)).toEqual(["a", "b", "c"]);
    expect(orderCategories([{ id: "a", position: 3 }, { id: "b", position: 1 }, { id: "c", position: 2 }]).map((r) => r.id)).toEqual(["b", "c", "a"]);
  });

  it("rearranges a subset in the places it held, leaving the rest alone", () => {
    // Income and Savings (i, s) stay put while the dashboard's lines (n1, n2, w1) are reordered.
    expect(rearrange(["i", "n1", "n2", "s", "w1"], ["w1", "n1", "n2"])).toEqual(["i", "w1", "n1", "s", "n2"]);
    expect(rearrange(["a", "b"], ["gone", "b", "a"])).toEqual(["b", "a"]);
  });
});
