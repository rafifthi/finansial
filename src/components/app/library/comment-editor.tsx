"use client";

import { useEffect, useMemo, useState } from "react";
import { Extension } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Placeholder } from "@tiptap/extensions";
import { Button } from "@/components/base/buttons/button";
import { bodyToDoc, docToBody } from "@/lib/library/comment-body";
import type { DocNode } from "@/lib/library/blocks";
import { cx } from "@/utils/cx";
import { peopleMentions } from "./editor/mention";
import { useLibrary } from "./library-context";

/** ⌘/Ctrl+Enter sends. High priority: the line-break shortcut would take it otherwise. */
const SendKey = Extension.create<{ events: EventTarget }>({
  name: "commentSendKey",
  priority: 1000,
  addOptions: () => ({ events: new EventTarget() }),
  addKeyboardShortcuts() {
    return { "Mod-Enter": () => this.options.events.dispatchEvent(new Event("send")) };
  },
});

/** Escape cancels. Low priority, so an open @ list closes first. */
const CancelKey = Extension.create<{ events: EventTarget; canCancel: boolean }>({
  name: "commentCancelKey",
  priority: 50,
  addOptions: () => ({ events: new EventTarget(), canCancel: false }),
  addKeyboardShortcuts() {
    // Without a Cancel, Escape goes on to whatever holds the box (the comments drawer).
    return { Escape: () => this.options.canCancel && this.options.events.dispatchEvent(new Event("cancel")) };
  },
});

/**
 * A comment box that knows @mentions: typing @ lists the book's people, the
 * same as on the page. What's sent is plain text with mention tokens
 * (lib/library/comment-body.ts), so the sheet stays readable.
 */
export function CommentEditor({
  label,
  placeholder,
  onSend,
  onCancel,
  initial = "",
  submit = "Comment",
  autoFocus,
}: {
  label: string;
  placeholder: string;
  onSend: (body: string) => Promise<boolean>;
  onCancel?: () => void;
  initial?: string;
  submit?: string;
  autoFocus?: boolean;
}) {
  const { members, userId } = useLibrary();
  const [sending, setSending] = useState(false);
  const [empty, setEmpty] = useState(!initial.trim());
  // The shortcuts announce themselves here, so the extension list doesn't change with each render.
  const [keyEvents] = useState(() => new EventTarget());
  const canCancel = Boolean(onCancel);

  const extensions = useMemo(
    () => [
      StarterKit.configure({
        heading: false,
        blockquote: false,
        codeBlock: false,
        horizontalRule: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
        listKeymap: false,
        code: false,
        trailingNode: false,
        dropcursor: false,
        link: { openOnClick: false, autolink: true, linkOnPaste: true, defaultProtocol: "https" },
      }),
      Placeholder.configure({ placeholder }),
      peopleMentions(members, userId),
      SendKey.configure({ events: keyEvents }),
      CancelKey.configure({ events: keyEvents, canCancel }),
    ],
    [keyEvents, canCancel, members, placeholder, userId],
  );

  const editor = useEditor({
    extensions,
    content: bodyToDoc(initial),
    immediatelyRender: false,
    editorProps: {
      attributes: { class: "comment-input outline-none", "aria-label": label, role: "textbox", "aria-multiline": "true" },
    },
    onUpdate: ({ editor: e }) => setEmpty(!docToBody(e.getJSON() as DocNode)),
  });

  const send = async () => {
    if (!editor || sending) return;
    const body = docToBody(editor.getJSON() as DocNode);
    if (!body) return;
    setSending(true);
    const ok = await onSend(body);
    setSending(false);
    if (ok) {
      editor.commands.clearContent(true);
      setEmpty(true);
    }
  };

  useEffect(() => {
    const onSendKey = () => void send();
    const onCancelKey = () => onCancel?.();
    keyEvents.addEventListener("send", onSendKey);
    keyEvents.addEventListener("cancel", onCancelKey);
    return () => {
      keyEvents.removeEventListener("send", onSendKey);
      keyEvents.removeEventListener("cancel", onCancelKey);
    };
  });

  // Explicit, since a menu closing can hand focus back to the page in the same tick.
  useEffect(() => {
    if (!autoFocus || !editor) return;
    const id = window.setTimeout(() => editor.commands.focus("end"), 0);
    return () => window.clearTimeout(id);
  }, [autoFocus, editor]);

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        void send();
      }}
    >
      <EditorContent
        editor={editor}
        className={cx(
          "max-h-60 min-h-14 cursor-text overflow-y-auto rounded-2lg bg-background-primary-default px-2.5 py-1.5 text-body-regular text-text-primary shadow-xs ring-1 ring-inset ring-border-input transition-shadow",
          "focus-within:ring-2 focus-within:ring-border-focus-ring",
        )}
        onClick={() => editor?.commands.focus()}
      />
      <div className="flex justify-end gap-2">
        {onCancel ? (
          <Button type="button" variant="secondary" size="small" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
        <Button type="submit" size="small" disabled={empty || sending}>
          {submit}
        </Button>
      </div>
    </form>
  );
}
