"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Editor, JSONContent } from "@tiptap/core";
import { DOMSerializer } from "@tiptap/pm/model";
import { RiCloseLine, RiSparkling2Line } from "@remixicon/react";
import { assistPage } from "@/actions/library-ai";
import { SmartComposer, type Attachment } from "@/components/ai/smart-composer";
import { Button } from "@/components/base/buttons/button";
import { Checkbox } from "@/components/base/checkbox/checkbox";
import { Drawer } from "@/components/base/drawer/drawer";
import { ScrollFade, useScrollFade } from "@/components/foundations/scroll-fade/scroll-fade";
import type { AssistTurn } from "@/lib/ai/library-assist";
import { shrinkImage } from "@/lib/ai/shrink-image";
import { cx } from "@/utils/cx";
import { useBookId } from "../permissions";
import { useWide } from "./comments";
import { applyChanges, pageAsMarkdown, previewChanges, type PreviewChange } from "./editor/ai-edits";

/** What the assistant is pointed at: some blocks (from a selection or a block's menu), or the whole page. */
export interface AiFocus {
  ids: string[];
  text: string;
}

interface Proposal {
  title?: string;
  changes: PreviewChange[];
  chosen: Set<string>;
}

/** Blocks drawn the way the page draws them (the editor's own schema), for the before/after preview. */
function BlocksPreview({ editor, nodes, tone }: { editor: Editor; nodes: JSONContent[]; tone: "before" | "after" }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.replaceChildren();
    try {
      const fragment = editor.schema.nodeFromJSON({ type: "doc", content: nodes }).content;
      el.appendChild(DOMSerializer.fromSchema(editor.schema).serializeFragment(fragment));
    } catch {
      el.textContent = "(can't preview this part)";
    }
  }, [editor, nodes]);
  return (
    <div
      ref={ref}
      className={cx(
        "library-prose pointer-events-none max-h-56 overflow-hidden rounded-xl px-2.5 py-2 text-body-regular",
        tone === "before" ? "bg-chip-overdue-background line-through decoration-text-tertiary opacity-80" : "bg-chip-date-background",
      )}
    />
  );
}

const LABEL: Record<PreviewChange["change"]["op"], string> = { replace: "Change", insert_after: "Add", delete: "Remove" };

const PAGE_IDEAS = ["Tidy this page up with headings", "Fix spelling and grammar", "Add a short summary at the top", "Translate to Bahasa Indonesia"];
const FOCUS_IDEAS = ["Rewrite this more clearly", "Make it shorter", "Turn this into a checklist", "Turn this into a table"];

/**
 * The page's writing assistant (DeepSeek). It proposes edits to particular
 * blocks; they show here as before → after and change nothing until Apply
 * (AI output is never saved on its own). One ⌘Z undoes an applied edit.
 */
function AiBody({
  editor,
  title,
  onTitle,
  focus,
  clearFocus,
  onTargets,
}: {
  editor: Editor;
  title: string;
  onTitle: (title: string) => void;
  focus: AiFocus | null;
  clearFocus: () => void;
  onTargets: (ids: string[]) => void;
}) {
  const bookId = useBookId();
  const [turns, setTurns] = useState<AssistTurn[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const fade = useScrollFade();
  const scroller = useRef<HTMLDivElement>(null);

  // The blocks a waiting proposal would change are tinted in the page.
  useEffect(() => {
    onTargets(proposal ? proposal.changes.flatMap((c) => (c.change.op === "insert_after" ? [] : [c.change.id])) : []);
  }, [proposal, onTargets]);
  useEffect(() => () => onTargets([]), [onTargets]);

  // New messages and proposals scroll into view.
  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [turns, proposal, busy]);

  const ask = async (text: string, attachments: Attachment[] = []) => {
    const words = text.trim();
    if ((!words && !attachments.length) || busy) return;
    const next: AssistTurn[] = [...turns, { role: "user", text: words || "(see the photo)" }];
    setTurns(next);
    setProposal(null);
    setError("");
    setBusy(true);
    try {
      const images = await Promise.all(attachments.map((a) => shrinkImage(a.file)));
      const res = await assistPage(bookId, {
        title,
        blocks: pageAsMarkdown(editor),
        focus: focus?.ids ?? [],
        selection: focus?.text ?? "",
        turns: next.slice(-12),
        images,
      });
      if (!res.ok || !res.data) {
        setError(res.ok ? "The AI didn't answer. Try again." : res.error);
        return;
      }
      setTurns([...next, { role: "assistant", text: res.data.reply }]);
      const changes = previewChanges(editor, res.data.changes);
      // Everything starts ticked, a proposed title included ("title").
      if (changes.length || res.data.title) setProposal({ title: res.data.title, changes, chosen: new Set([...changes.map((c) => c.key), ...(res.data.title ? ["title"] : [])]) });
    } catch {
      setError("You're offline. Nothing was sent.");
    } finally {
      setBusy(false);
    }
  };

  const apply = () => {
    if (!proposal) return;
    const chosen = proposal.changes.filter((c) => proposal.chosen.has(c.key));
    applyChanges(editor, chosen);
    if (proposal.title && proposal.chosen.has("title")) onTitle(proposal.title);
    const n = chosen.length + (proposal.title && proposal.chosen.has("title") ? 1 : 0);
    setTurns((t) => [...t, { role: "assistant", text: `Applied ${n} change${n === 1 ? "" : "s"}. ⌘Z undoes the page edits.` }]);
    setProposal(null);
  };

  const toggle = (key: string, on: boolean) =>
    setProposal((p) => {
      if (!p) return p;
      const chosen = new Set(p.chosen);
      if (on) chosen.add(key);
      else chosen.delete(key);
      return { ...p, chosen };
    });

  const ideas = focus?.ids.length ? FOCUS_IDEAS : PAGE_IDEAS;
  const count = proposal ? proposal.changes.filter((c) => proposal.chosen.has(c.key)).length + (proposal.title && proposal.chosen.has("title") ? 1 : 0) : 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {focus?.ids.length ? (
        <div className="flex items-start gap-2 rounded-xl bg-background-secondary-default px-2.5 py-2">
          <span className="min-w-0 flex-1 text-body-2-regular text-text-secondary">
            <span className="text-text-primary">Working on </span>
            {focus.text ? <span className="line-clamp-2">“{focus.text}”</span> : `${focus.ids.length} block${focus.ids.length === 1 ? "" : "s"}`}
          </span>
          <button type="button" onClick={clearFocus} className="shrink-0 cursor-pointer rounded-md text-body-2-medium text-text-tertiary outline-none hover:text-text-secondary focus-visible:ring-2 focus-visible:ring-border-focus-ring">
            Whole page
          </button>
        </div>
      ) : null}

      <div className="relative flex min-h-0 flex-1 flex-col">
        <ScrollFade progress={fade.progress} surfaceClassName="from-background-full" />
        <div ref={scroller} onScroll={fade.onScroll} className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain pb-2">
          {!turns.length ? (
            <div className="flex flex-col gap-2">
              <p className="text-body-regular text-text-secondary">Ask for an edit and you’ll see it here before anything changes on the page.</p>
              <div className="flex flex-wrap gap-1.5">
                {ideas.map((idea) => (
                  <button
                    key={idea}
                    type="button"
                    onClick={() => void ask(idea)}
                    className="cursor-pointer rounded-full border border-border-button-default px-2.5 py-1 text-body-2-medium text-text-secondary outline-none transition-colors hover:border-border-button-hover hover:text-text-primary focus-visible:ring-2 focus-visible:ring-border-focus-ring max-sm:min-h-9"
                  >
                    {idea}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {turns.map((t, i) => (
            <div key={i} className={cx("max-w-[90%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-body-regular", t.role === "user" ? "self-end bg-background-tertiary-default text-text-primary" : "self-start text-text-primary")}>
              {t.text}
            </div>
          ))}
          {busy ? <p className="animate-pulse self-start px-1 text-body-2-regular text-text-tertiary motion-reduce:animate-none">Reading the page…</p> : null}
          {error ? (
            <p role="alert" className="self-start px-1 text-body-2-regular text-text-error-primary">
              {error}
            </p>
          ) : null}

          {proposal ? (
            <section aria-label="Proposed changes" className="flex flex-col gap-3 rounded-3xl border border-border-button-hover bg-background-primary-default p-3">
              {proposal.title ? (
                <div className="flex flex-col gap-1.5">
                  <Checkbox size="sm" isSelected={proposal.chosen.has("title")} onChange={(on) => toggle("title", on)}>
                    <span className="text-body-2-medium text-text-secondary">Rename the page</span>
                  </Checkbox>
                  <p className="ps-6 text-body-medium text-text-primary">
                    <span className="text-text-tertiary line-through">{title || "Untitled"}</span> → {proposal.title}
                  </p>
                </div>
              ) : null}
              {proposal.changes.map((c) => (
                <div key={c.key} className="flex flex-col gap-1.5">
                  <Checkbox size="sm" isSelected={proposal.chosen.has(c.key)} onChange={(on) => toggle(c.key, on)}>
                    <span className="text-body-2-medium text-text-secondary">{LABEL[c.change.op]}</span>
                  </Checkbox>
                  <div className="flex flex-col gap-1 ps-6">
                    {c.before.length ? <BlocksPreview editor={editor} nodes={c.before} tone="before" /> : null}
                    {c.after.length ? <BlocksPreview editor={editor} nodes={c.after} tone="after" /> : null}
                  </div>
                </div>
              ))}
              <div className="flex flex-wrap justify-end gap-2">
                <Button size="small" variant="secondary" onClick={() => setProposal(null)}>
                  Discard
                </Button>
                <Button size="small" onClick={apply} disabled={!count}>
                  Apply {count} change{count === 1 ? "" : "s"}
                </Button>
              </div>
            </section>
          ) : null}
        </div>
      </div>

      <SmartComposer label="Ask AI about this page" onSend={(text, files) => void ask(text, files)} busy={busy} placeholder={focus?.ids.length ? "What should change here?" : "Ask AI to edit this page…"} onError={setError} />
    </div>
  );
}

function PanelHeader({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <h2 className="flex items-center gap-1.5 text-title-2-semibold text-text-primary">
        <RiSparkling2Line className="size-4 text-foreground-icon-secondary" aria-hidden />
        Ask AI
      </h2>
      <Button variant="secondary" size="small" iconOnly leadingIcon={RiCloseLine} aria-label="Close Ask AI" onClick={onClose} className="border-transparent bg-transparent" />
    </div>
  );
}

/** Docked beside the page like the comments (a drawer on narrow screens). */
export function AiPanel({ open, onClose, ...body }: Parameters<typeof AiBody>[0] & { open: boolean; onClose: () => void }) {
  const wide = useWide();
  if (wide) {
    if (!open) return null;
    return (
      <aside aria-label="Ask AI" className="sticky top-4 flex h-[calc(100dvh-4rem)] min-h-0 flex-col gap-3 border-s border-separator-border ps-5">
        <PanelHeader onClose={onClose} />
        <AiBody {...body} />
      </aside>
    );
  }
  return (
    <Drawer isOpen={open} onOpenChange={(o) => !o && onClose()} placement="end" size="md" aria-label="Ask AI" className="flex h-full flex-col gap-3 rounded-3xl bg-background-full p-4">
      <PanelHeader onClose={onClose} />
      <AiBody {...body} />
    </Drawer>
  );
}
