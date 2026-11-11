import { describe, expect, it } from "vitest";
import { buildPrompt, sanitizeReply } from "./library-assist";

describe("library assist", () => {
  it("numbers the blocks and lists the focus and people", () => {
    const prompt = buildPrompt({
      title: "House info",
      blocks: [
        { id: "a", markdown: "## Contacts" },
        { id: "b", markdown: "- RT: Pak Budi" },
      ],
      focus: ["b"],
      selection: "Pak Budi",
      turns: [{ role: "user", text: "make it a table" }],
      members: [{ id: "u-kanza", name: "Kanza" }],
      today: "2026-11-11",
    });
    expect(prompt).toContain("[a] ## Contacts\n\n[b] - RT: Pak Budi");
    expect(prompt).toContain("Focus: blocks [b]");
    expect(prompt).toContain('Selected words: """Pak Budi"""');
    expect(prompt).toContain('Kanza: id "u-kanza"');
    expect(prompt).toContain("Person: make it a table");
  });

  it("keeps edits to known blocks and drops the rest", () => {
    const out = sanitizeReply(
      {
        reply: "Done",
        changes: [
          { op: "replace", id: "a", markdown: "## People" },
          { op: "replace", id: "a", markdown: "again" },
          { op: "replace", id: "nope", markdown: "x" },
          { op: "delete", id: "b" },
          { op: "insert_after", after: "", markdown: "# Top" },
          { op: "insert_after", after: "ghost", markdown: "lost" },
          { op: "replace", id: "c", markdown: "   " },
          { op: "rename", id: "a" },
        ],
      },
      ["a", "b", "c"],
    );
    expect(out.changes).toEqual([
      { op: "replace", id: "a", markdown: "## People" },
      { op: "delete", id: "b" },
      { op: "insert_after", after: "", markdown: "# Top" },
    ]);
    expect(out.reply).toBe("Done");
  });

  it("survives a reply that isn't the expected shape", () => {
    expect(sanitizeReply("oops", ["a"])).toEqual({ reply: "I couldn't find anything to change.", changes: [] });
    expect(sanitizeReply({ title: " New title ", changes: "x" }, [])).toEqual({ reply: "I couldn't find anything to change.", title: "New title", changes: [] });
  });
});
