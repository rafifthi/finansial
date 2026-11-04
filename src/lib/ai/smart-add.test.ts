import { describe, expect, it } from "vitest";
import { buildPrompt, sanitizeReply, type BookContext } from "./smart-add";

const ctx: BookContext = {
  today: "2026-11-04",
  currency: "IDR",
  categories: [
    { id: "meals", name: "Meals", group: "Needs", kind: "expense" },
    { id: "salary", name: "Gaji", group: "Income", kind: "income" },
    { id: "travel", name: "Travel", group: "Savings", kind: "expense" },
  ],
  accounts: [
    { id: "jago", name: "Jago", type: "bank" },
    { id: "bibit", name: "Bibit", type: "investment" },
  ],
  members: ["Kanza", "Rafif"],
};

const draft = (p: Record<string, unknown>) => ({
  date: "2026-11-04",
  type: "expense",
  amount: 35000,
  category_id: "meals",
  from_category_id: "",
  account_id: "jago",
  to_account_id: "",
  description: "Nasi Padang",
  member: "",
  ...p,
});

describe("sanitizeReply", () => {
  it("keeps a valid draft as is", () => {
    const out = sanitizeReply({ reply: "Siap", drafts: [draft({ member: "Kanza" })] }, ctx);
    expect(out).toEqual({ reply: "Siap", drafts: [{ ...draft({ member: "Kanza" }) }] });
  });

  it("drops invented ids, unknown members, and a category of the wrong kind", () => {
    const [d] = sanitizeReply({ drafts: [draft({ category_id: "salary", account_id: "bca", member: "Budi" })] }, ctx).drafts;
    expect(d).toMatchObject({ category_id: "", account_id: "", member: "" });
  });

  it("runs transfers category to category and leaves the accounts to the server", () => {
    const [ok, same] = sanitizeReply(
      {
        drafts: [
          draft({ type: "transfer", from_category_id: "meals", category_id: "travel", account_id: "jago", to_account_id: "bibit" }),
          draft({ type: "transfer", from_category_id: "travel", category_id: "travel" }),
        ],
      },
      ctx,
    ).drafts;
    expect(ok).toMatchObject({ from_category_id: "meals", category_id: "travel", account_id: "", to_account_id: "" });
    expect(same).toMatchObject({ from_category_id: "", category_id: "travel" });
  });

  it("fixes dates, types and amounts, and skips zero amounts", () => {
    const out = sanitizeReply(
      {
        drafts: [
          draft({ date: "kemarin", type: "spend", amount: "18000.4" }),
          draft({ date: "2027-01-01", amount: -50000 }),
          draft({ amount: 0 }),
        ],
      },
      ctx,
    ).drafts;
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ date: "2026-11-04", type: "expense", amount: 18000 });
    expect(out[1]).toMatchObject({ date: "2026-11-04", amount: 50000 });
  });

  it("survives a malformed reply", () => {
    expect(sanitizeReply("nope", ctx)).toEqual({ reply: "", drafts: [] });
    expect(sanitizeReply({ reply: "Hi", drafts: "x" }, ctx)).toEqual({ reply: "Hi", drafts: [] });
  });
});

describe("buildPrompt", () => {
  it("includes the book, current drafts, the remap note and the conversation", () => {
    const p = buildPrompt(
      ctx,
      [{ role: "user", text: "kopi 18rb" }],
      [{ date: "2026-11-04", type: "expense", amount: 18000, category: "Meals", from_category: "", account: "", to_account: "", description: "Kopi", member: "" }],
      true,
    );
    expect(p).toContain('"id":"meals"');
    expect(p).toContain('"category":"Meals"');
    expect(p).toContain("switched to this book");
    expect(p).toContain("User: kopi 18rb");
  });
});
