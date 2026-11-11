/**
 * The Library's writing assistant: DeepSeek reads a page as numbered
 * Markdown blocks and proposes edits to particular blocks. Nothing is saved
 * here; the editor shows the proposal and applies it only when the person
 * says so (the app never saves AI output on its own).
 */

export interface AssistBlock {
  id: string;
  markdown: string;
}

export interface AssistTurn {
  role: "user" | "assistant";
  text: string;
}

export interface AssistInput {
  title: string;
  blocks: AssistBlock[];
  /** Blocks the person picked (selected words, or a block's menu); edits should stay within them. */
  focus: string[];
  /** The exact words selected, when there are some. */
  selection: string;
  turns: AssistTurn[];
  members: { id: string; name: string }[];
  today: string;
}

export type AssistChange =
  | { op: "replace"; id: string; markdown: string }
  | { op: "insert_after"; after: string; markdown: string }
  | { op: "delete"; id: string };

export interface AssistReply {
  reply: string;
  title?: string;
  changes: AssistChange[];
}

export const MAX_PAGE_CHARS = 60_000;
const MAX_CHANGES = 80;
const MAX_MARKDOWN = 20_000;

export const SYSTEM = `You help a household keep their shared notes (a "Library" of pages: how-tos, contacts, plans, house info). You edit one page at a time. They write in English or Indonesian; answer in the language they use.

The page comes as numbered blocks, each "[id] markdown". Propose edits as JSON only:
{
  "reply": "one or two short sentences saying what you changed or answering the question",
  "title": "new page title (only when asked to change it)",
  "changes": [
    { "op": "replace", "id": "<block id>", "markdown": "the block's new content" },
    { "op": "insert_after", "after": "<block id, or \\"\\" for the very top>", "markdown": "new blocks" },
    { "op": "delete", "id": "<block id>" }
  ]
}

Rules:
- Change only what the request needs. Leave every other block out of "changes". Never reproduce unchanged blocks.
- If "Focus" lists blocks, keep your edits to those blocks (and new blocks right after them) unless asked otherwise.
- A replacement may hold several blocks (e.g. a paragraph becoming a heading plus a list); separate them with a blank line.
- Markdown you may use: # ## ### headings, paragraphs, - and 1. lists, "- [ ] " and "- [x] " checklists, > quotes, \`\`\` code blocks, ---, GFM tables (with a header row), **bold**, *italic*, ~~strike~~, \`code\`, [text](https://…) links.
- People: write a mention exactly as [@ id="<id>" label="<name>"], only for the people listed. Dates: [date value="YYYY-MM-DD"].
- Keep facts as they are: names, phone numbers, amounts, account numbers, addresses, dates. Don't invent details; if something is missing, say so in "reply" instead of guessing.
- If the person only asks a question about the page, answer in "reply" with "changes": [].
- No HTML. No text outside the JSON.`;

/** The request as the model reads it: who's who, the page, what's in focus, then the conversation. */
export function buildPrompt(input: AssistInput): string {
  const people = input.members.length ? input.members.map((m) => `- ${m.name}: id "${m.id}"`).join("\n") : "- (none)";
  const page = input.blocks.length ? input.blocks.map((b) => `[${b.id}] ${b.markdown}`).join("\n\n") : "(the page is empty: add blocks with insert_after and after \"\")";
  const focus = input.focus.length
    ? `\nFocus: blocks ${input.focus.map((id) => `[${id}]`).join(", ")}${input.selection ? `\nSelected words: """${input.selection}"""` : ""}\n`
    : "";
  const talk = input.turns.map((t) => `${t.role === "user" ? "Person" : "You"}: ${t.text}`).join("\n");
  return `Today: ${input.today}
People in this book:
${people}

Page title: ${input.title || "Untitled"}
Page:
${page}
${focus}
Conversation (latest last):
${talk}

Reply with the JSON object.`;
}

const str = (v: unknown) => (typeof v === "string" ? v : "");

/**
 * Keeps only edits that make sense for this page: known block ids, real
 * content, no repeats. Anything else is dropped rather than guessed at.
 */
export function sanitizeReply(raw: unknown, blockIds: readonly string[]): AssistReply {
  const obj = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const known = new Set(blockIds);
  const touched = new Set<string>();
  const changes: AssistChange[] = [];
  for (const c of Array.isArray(obj.changes) ? obj.changes : []) {
    if (changes.length >= MAX_CHANGES || !c || typeof c !== "object") continue;
    const ch = c as Record<string, unknown>;
    const markdown = str(ch.markdown).trim().slice(0, MAX_MARKDOWN);
    if (ch.op === "replace" || ch.op === "delete") {
      const id = str(ch.id);
      if (!known.has(id) || touched.has(id)) continue;
      if (ch.op === "replace" && !markdown) continue;
      touched.add(id);
      changes.push(ch.op === "replace" ? { op: "replace", id, markdown } : { op: "delete", id });
    } else if (ch.op === "insert_after") {
      const after = str(ch.after);
      if ((after && !known.has(after)) || !markdown) continue;
      changes.push({ op: "insert_after", after, markdown });
    }
  }
  const title = str(obj.title).trim().slice(0, 200);
  const reply = str(obj.reply).trim().slice(0, 2000) || (changes.length ? "Here's a suggestion." : "I couldn't find anything to change.");
  return { reply, ...(title ? { title } : {}), changes };
}
