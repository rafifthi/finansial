import type { DocNode } from "./blocks";

/*
 * A comment's body is plain text in the sheet, so it stays readable there.
 * An @mention is written `@[Kanza](u-kanza)`: the name to show and the
 * person's id, which survives a rename.
 */

const TOKEN = /@\[([^\]\n]{1,80})\]\(([A-Za-z0-9_-]{1,64})\)/g;

export type BodyPart = { kind: "text"; text: string } | { kind: "mention"; id: string; label: string };

/** The body split into text runs and mentions, for showing it. */
export function bodyParts(body: string): BodyPart[] {
  const out: BodyPart[] = [];
  let last = 0;
  for (const m of body.matchAll(TOKEN)) {
    if (m.index! > last) out.push({ kind: "text", text: body.slice(last, m.index) });
    out.push({ kind: "mention", label: m[1], id: m[2] });
    last = m.index! + m[0].length;
  }
  if (last < body.length) out.push({ kind: "text", text: body.slice(last) });
  return out;
}

/** The ids of everyone mentioned, each once. */
export function bodyMentionIds(body: string): string[] {
  return [...new Set([...body.matchAll(TOKEN)].map((m) => m[2]))];
}

/** The body as people read it: `@Kanza` instead of the token. */
export function bodyText(body: string): string {
  return body.replace(TOKEN, (_, label: string) => `@${label}`);
}

/** The comment editor's document → the stored body. */
export function docToBody(doc: DocNode): string {
  const inline = (n: DocNode): string => {
    if (n.type === "text") return n.text ?? "";
    if (n.type === "hardBreak") return "\n";
    if (n.type === "mention") return `@[${String(n.attrs?.label ?? "").replace(/[\]\n]/g, "")}](${String(n.attrs?.id ?? "")})`;
    return (n.content ?? []).map(inline).join("");
  };
  return (doc.content ?? [])
    .map(inline)
    .join("\n")
    .trim();
}

/** A stored body → the comment editor's document, mentions as chips again. */
export function bodyToDoc(body: string): DocNode {
  const lines = body.split("\n");
  return {
    type: "doc",
    content: lines.map((line) => {
      const content: DocNode[] = bodyParts(line).flatMap((p): DocNode[] =>
        p.kind === "mention" ? [{ type: "mention", attrs: { id: p.id, label: p.label } }] : p.text ? [{ type: "text", text: p.text }] : [],
      );
      return { type: "paragraph", ...(content.length ? { content } : {}) };
    }),
  };
}
