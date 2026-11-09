import { describe, expect, it } from "vitest";
import { bodyMentionIds, bodyParts, bodyText, bodyToDoc, docToBody } from "./comment-body";
import type { DocNode } from "./blocks";

const body = "Can @[Kanza](u-kanza) check?\nThanks @[Rafif Fathi](u-rafif) and @[Kanza](u-kanza)";

describe("comment bodies", () => {
  it("splits text and mentions", () => {
    expect(bodyParts("Hi @[Kanza](u-kanza)!")).toEqual([
      { kind: "text", text: "Hi " },
      { kind: "mention", id: "u-kanza", label: "Kanza" },
      { kind: "text", text: "!" },
    ]);
  });

  it("lists each mentioned person once", () => {
    expect(bodyMentionIds(body)).toEqual(["u-kanza", "u-rafif"]);
  });

  it("reads as plain @names", () => {
    expect(bodyText(body)).toBe("Can @Kanza check?\nThanks @Rafif Fathi and @Kanza");
  });

  it("leaves a bare @ or an email alone", () => {
    expect(bodyMentionIds("mail me @ kanza@example.com")).toEqual([]);
  });

  it("goes to the editor's document and back unchanged", () => {
    expect(docToBody(bodyToDoc(body))).toBe(body);
  });

  it("writes a mention chip as a token and trims empty lines at the ends", () => {
    const doc: DocNode = {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "Ask " }, { type: "mention", attrs: { id: "u-kanza", label: "Kanza" } }] }, { type: "paragraph" }],
    };
    expect(docToBody(doc)).toBe("Ask @[Kanza](u-kanza)");
  });
});
