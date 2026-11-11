"use server";

import { z } from "zod";
import { completeJson, IMAGE_TYPES } from "@/lib/ai/client";
import { buildPrompt, MAX_PAGE_CHARS, sanitizeReply, SYSTEM } from "@/lib/ai/library-assist";
import { bookAction } from "@/lib/data/action";
import { registry } from "@/lib/data/registry";
import { today } from "@/lib/finance/dates";

/**
 * Asks DeepSeek for edits to a Library page. Returns a proposal only: the
 * page is not touched here, and the editor applies the changes only when
 * the person presses Apply.
 */
export const assistPage = bookAction(
  "data:write",
  z.object({
    title: z.string().max(200),
    blocks: z.array(z.object({ id: z.string().min(1).max(64), markdown: z.string().max(MAX_PAGE_CHARS) })).max(2000),
    focus: z.array(z.string().max(64)).max(500).default([]),
    selection: z.string().max(4000).default(""),
    turns: z
      .array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().max(4000) }))
      .min(1)
      .max(20),
    images: z
      .array(z.object({ media_type: z.enum(IMAGE_TYPES), data: z.string().min(1).max(4_000_000) }))
      .max(4, "Up to 4 images per message")
      .default([]),
  }),
  async (input, { book }) => {
    const size = input.blocks.reduce((n, b) => n + b.markdown.length, 0);
    if (size > MAX_PAGE_CHARS) throw new Error("This page is too long to send to the AI in one go. Select the part you want help with.");
    // The book's people, so mentions point at real ids.
    const [users, memberships] = await Promise.all([registry().rows("users"), registry().rows("memberships")]);
    const byId = new Map(users.map((u) => [u.id, u]));
    const members = memberships.filter((m) => m.book_id === book.id && byId.has(m.user_id)).map((m) => ({ id: m.user_id, name: byId.get(m.user_id)!.name }));

    const raw = await completeJson({ system: SYSTEM, prompt: buildPrompt({ ...input, members, today: today() }), images: input.images });
    return sanitizeReply(
      raw,
      input.blocks.map((b) => b.id),
    );
  },
  { refresh: false },
);
