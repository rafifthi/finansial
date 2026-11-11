import { describe, expect, it } from "vitest";
import { Schema } from "@tiptap/pm/model";
import { colorOf, posOf, spotAt, typedChars } from "./live";

const schema = new Schema({
  nodes: {
    doc: { content: "block+" },
    paragraph: { group: "block", content: "text*", attrs: { id: { default: null } } },
    text: {},
  },
});

const doc = (...blocks: [string, string][]) =>
  schema.node(
    "doc",
    null,
    blocks.map(([id, text]) => schema.node("paragraph", { id }, text ? [schema.text(text)] : [])),
  );

describe("live cursors", () => {
  it("sends a caret as a spot in its block and finds it again", () => {
    const d = doc(["a", "Hello"], ["b", "World"]);
    // Block a spans 0–7; position 11 is after "Wor" in block b, 4 into it.
    const spot = spotAt(d, 11);
    expect(spot).toEqual({ block: "b", offset: 4 });
    expect(posOf(d, spot!)).toBe(11);
  });

  it("keeps a spot inside its block when this copy of the block is shorter", () => {
    const d = doc(["a", "Hi"], ["b", "Wo"]);
    expect(posOf(d, { block: "a", offset: 40 })).toBe(3);
    expect(posOf(d, { block: "gone", offset: 1 })).toBeNull();
  });

  it("finds just the characters someone else typed", () => {
    const before = doc(["a", "Spare keys are here."], ["b", "Same"]);
    const after = doc(["a", "Spare keys are in the box here."], ["b", "Same"], ["c", "New"]);
    const typed = typedChars(before, after);
    const text = typed.map((pos) => after.textBetween(pos, pos + 1)).join("");
    // "in the box " went into block a; block c is new; block b didn't change.
    expect(text).toBe("in the box New");
  });

  it("gives each person a steady colour", () => {
    expect(colorOf("u-kanza")).toBe(colorOf("u-kanza"));
    expect(colorOf("u-kanza")).toMatch(/^var\(--color-chart-[1-5]-active\)$/);
  });
});
