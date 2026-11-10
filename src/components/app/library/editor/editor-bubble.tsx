"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { autoUpdate, computePosition, flip, offset, shift } from "@floating-ui/dom";
import { posToDOMRect, type Editor } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";
import { useEditorState } from "@tiptap/react";
import {
  type RemixiconComponentType,
  RiBold,
  RiChat3Line,
  RiCodeLine,
  RiExternalLinkLine,
  RiItalic,
  RiLinkM,
  RiLinkUnlinkM,
  RiPencilLine,
  RiStrikethrough,
  RiUnderline,
} from "@remixicon/react";
import { Button } from "@/components/base/buttons/button";
import { MENU_POPOVER_SURFACE } from "@/components/base/dropdown/menu-styles";
import { Input } from "@/components/base/input/input";
import { cx } from "@/utils/cx";
import { blockAtSelection } from "./comment-marks";
import { applyLink, linkDraftAt, normalizeHref, removeLink, type LinkDraft } from "./link";

/** A panel pinned to a stretch of the document, following it as the page scrolls. */
export function Floating({ editor, from, to, children, label, placement = "top" }: { editor: Editor; from: number; to: number; children: ReactNode; label: string; placement?: "top" | "top-start" | "bottom-start" }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reference = {
      getBoundingClientRect: () => posToDOMRect(editor.view, Math.min(from, editor.state.doc.content.size), Math.min(to, editor.state.doc.content.size)),
      contextElement: editor.view.dom,
    };
    return autoUpdate(reference, el, () => {
      void computePosition(reference, el, {
        placement,
        strategy: "fixed",
        middleware: [offset(8), flip({ fallbackPlacements: [placement === "top" ? "bottom" : placement === "top-start" ? "bottom-start" : "top-start"] }), shift({ padding: 12 })],
      }).then(({ x, y }) => {
        el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
        el.style.visibility = "visible";
      });
    });
  }, [editor, from, to, placement]);
  return createPortal(
    <div ref={ref} role="dialog" aria-label={label} style={{ visibility: "hidden" }} className="fixed start-0 top-0 z-110">
      {children}
    </div>,
    document.body,
  );
}

export function ToolButton({ icon: Icon, label, active, onPress }: { icon: RemixiconComponentType; label: string; active?: boolean; onPress: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      // Keep the selection in the editor.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onPress}
      className={cx(
        "flex size-7 cursor-pointer items-center justify-center rounded-lg outline-none transition-colors focus-visible:ring-2 focus-visible:ring-border-focus-ring",
        active ? "bg-dropdown-item-hover-background text-foreground-icon-primary" : "text-foreground-icon-secondary hover:bg-dropdown-item-hover-background",
      )}
    >
      <Icon className="size-4" aria-hidden />
    </button>
  );
}

export const BAR = cx(MENU_POPOVER_SURFACE, "flex items-center gap-0.5 p-1");

function LinkForm({ draft, onDone, editor }: { draft: LinkDraft; onDone: () => void; editor: Editor }) {
  const [text, setText] = useState(draft.text);
  const [href, setHref] = useState(draft.href);
  const [error, setError] = useState("");
  const textRef = useRef<HTMLInputElement>(null);
  const urlRef = useRef<HTMLInputElement>(null);
  // Words already chosen: straight to the address. Otherwise start with the words.
  useEffect(() => {
    const target = draft.text ? urlRef.current : textRef.current;
    target?.focus();
    target?.select();
  }, [draft.text]);
  const save = () => {
    if (!href.trim()) {
      if (draft.existing) removeLink(editor, draft);
      onDone();
      return;
    }
    const safe = normalizeHref(href);
    if (!safe) {
      setError("Use a web address, like pln.co.id or https://…");
      return;
    }
    applyLink(editor, draft, text, safe);
    onDone();
  };
  return (
    <form
      data-link-form
      className={cx(MENU_POPOVER_SURFACE, "flex w-80 flex-col gap-3 p-3")}
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <Input ref={textRef} label="Text" placeholder="Click here" value={text} onChange={setText} autoComplete="off" />
      <Input
        label="URL"
        placeholder="https://"
        // Not type="url": the browser would refuse "pln.co.id" before normalizeHref can add https://.
        inputMode="url"
        autoComplete="off"
        inputDir="ltr"
        value={href}
        onChange={(v) => {
          setHref(v);
          setError("");
        }}
        ref={urlRef}
        isInvalid={Boolean(error)}
        errorMessage={error}
      />
      <div className="flex justify-end gap-2">
        {draft.existing ? (
          <Button
            type="button"
            variant="secondary"
            size="small"
            leadingIcon={RiLinkUnlinkM}
            onClick={() => {
              removeLink(editor, draft);
              onDone();
            }}
          >
            Remove link
          </Button>
        ) : null}
        <Button type="submit" size="small">
          {draft.existing ? "Save" : "Add link"}
        </Button>
      </div>
    </form>
  );
}

/**
 * The editor's floating panels: a formatting bar over selected words, a link
 * card when the cursor sits on a link, and the link form (⌘K) with separate
 * Text and URL fields, so an address can hide behind words like "Click here".
 */
export function EditorBubble({ editor, linkEvents, onComment }: { editor: Editor; linkEvents: EventTarget; onComment?: (id: string, text: string) => void }) {
  const [draft, setDraft] = useState<LinkDraft | null>(null);
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      const { from, to, empty } = e.state.selection;
      return {
        from,
        to,
        empty,
        focused: e.isFocused,
        inCode: e.isActive("codeBlock"),
        link: e.isActive("link") ? String(e.getAttributes("link").href ?? "") : null,
        bold: e.isActive("bold"),
        italic: e.isActive("italic"),
        underline: e.isActive("underline"),
        strike: e.isActive("strike"),
        code: e.isActive("code"),
        // A whole-node selection (a divider) has no words to format.
        text: e.state.selection instanceof TextSelection,
      };
    },
  });

  // ⌘K opens the form for whatever is under the cursor.
  useEffect(() => {
    const open = () => editor.isEditable && setDraft(linkDraftAt(editor));
    linkEvents.addEventListener("open", open);
    return () => linkEvents.removeEventListener("open", open);
  }, [linkEvents, editor]);

  // A press anywhere outside the form closes it without saving.
  const open = draft !== null;
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!(e.target as Element | null)?.closest?.("[data-link-form]")) setDraft(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      setDraft(null);
      editor.commands.focus();
    };
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open, editor]);

  if (!s) return null;
  if (draft) {
    return (
      <Floating editor={editor} from={draft.from} to={draft.to} label="Link" placement="top-start">
        <LinkForm key={`${draft.from}-${draft.to}`} draft={draft} editor={editor} onDone={() => setDraft(null)} />
      </Floating>
    );
  }
  if (!s.focused || !editor.isEditable) return null;

  if (!s.empty && !s.inCode && s.text) {
    const toggle = (name: "toggleBold" | "toggleItalic" | "toggleUnderline" | "toggleStrike" | "toggleCode") => () => editor.chain().focus()[name]().run();
    return (
      <Floating editor={editor} from={s.from} to={s.to} label="Formatting">
        <div className={BAR}>
          <ToolButton icon={RiBold} label="Bold (⌘B)" active={s.bold} onPress={toggle("toggleBold")} />
          <ToolButton icon={RiItalic} label="Italic (⌘I)" active={s.italic} onPress={toggle("toggleItalic")} />
          <ToolButton icon={RiUnderline} label="Underline (⌘U)" active={s.underline} onPress={toggle("toggleUnderline")} />
          <ToolButton icon={RiStrikethrough} label="Strikethrough" active={s.strike} onPress={toggle("toggleStrike")} />
          <ToolButton icon={RiCodeLine} label="Inline code" active={s.code} onPress={toggle("toggleCode")} />
          <span className="mx-0.5 h-4 w-px bg-separator-border" aria-hidden />
          <ToolButton icon={RiLinkM} label="Link (⌘K)" active={s.link !== null} onPress={() => setDraft(linkDraftAt(editor))} />
          {onComment ? (
            <ToolButton
              icon={RiChat3Line}
              label="Comment"
              onPress={() => {
                const at = blockAtSelection(editor);
                if (at) onComment(at.id, at.text);
              }}
            />
          ) : null}
        </div>
      </Floating>
    );
  }

  if (s.empty && s.link !== null) {
    return (
      <Floating editor={editor} from={s.from} to={s.to} label="Link">
        <div className={cx(BAR, "max-w-80 ps-2.5")}>
          <a
            href={s.link}
            target="_blank"
            rel="noopener noreferrer"
            dir="ltr"
            onMouseDown={(e) => e.preventDefault()}
            className="min-w-0 flex-1 truncate text-body-2-regular text-button-ghost-foreground underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-border-focus-ring"
          >
            {s.link}
          </a>
          <ToolButton icon={RiExternalLinkLine} label="Open in a new tab" onPress={() => window.open(s.link!, "_blank", "noopener,noreferrer")} />
          <ToolButton icon={RiPencilLine} label="Edit link" onPress={() => setDraft(linkDraftAt(editor))} />
          <ToolButton icon={RiLinkUnlinkM} label="Remove link" onPress={() => removeLink(editor, linkDraftAt(editor))} />
        </div>
      </Floating>
    );
  }
  return null;
}
