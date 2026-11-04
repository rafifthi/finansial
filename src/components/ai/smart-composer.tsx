"use client";

import {
  RiAddLine,
  RiArrowUpLine,
  RiCameraLine,
  RiImageAddLine,
  RiImageLine,
  RiMicFill,
  RiMicLine,
  RiCloseLine,
} from "@remixicon/react";
import { useRef, useState, type ClipboardEvent, type DragEvent, type FormEvent, type KeyboardEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { useSpeech } from "@/hooks/use-speech";
import { cn } from "@/lib/utils";

export interface Attachment {
  id: string;
  name: string;
  file: File;
  preview: string;
}

/**
 * The Catat (AI capture) input: text, images (attach, camera, drag and drop, paste)
 * and voice in one box. Adapted from blocks.so ai-04 (attachments and the
 * drop overlay) and ai-01 (mic and send).
 */
export function SmartComposer({
  onSend,
  busy,
  placeholder = "e.g. makan padang 35rb pakai jago, kopi 18rb",
  speechLang = "id-ID",
  onError,
}: {
  onSend: (text: string, attachments: Attachment[]) => void;
  busy?: boolean;
  placeholder?: string;
  speechLang?: string;
  onError?: (message: string) => void;
}) {
  const [text, setText] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const textBeforeSpeech = useRef("");

  const speech = useSpeech({
    lang: speechLang,
    onText: (spoken) => setText([textBeforeSpeech.current, spoken].filter(Boolean).join(" ")),
    onError,
  });

  const addFiles = (files: File[]) => {
    const images = files.filter((f) => f.type.startsWith("image/"));
    if (files.length && !images.length) onError?.("Only images can be attached.");
    setAttachments((prev) =>
      [...prev, ...images.map((file) => ({ id: crypto.randomUUID(), name: file.name || "Pasted image", file, preview: URL.createObjectURL(file) }))].slice(0, 6),
    );
  };

  const remove = (id: string) =>
    setAttachments((prev) => {
      const gone = prev.find((a) => a.id === id);
      if (gone) URL.revokeObjectURL(gone.preview);
      return prev.filter((a) => a.id !== id);
    });

  const canSend = !busy && (text.trim().length > 0 || attachments.length > 0);

  const submit = () => {
    if (!canSend) return;
    if (speech.listening) speech.stop();
    onSend(text.trim(), attachments);
    setText("");
    setAttachments([]);
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    submit();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };

  const onPaste = (e: ClipboardEvent) => {
    const files = [...e.clipboardData.files];
    if (files.some((f) => f.type.startsWith("image/"))) {
      e.preventDefault();
      addFiles(files);
    }
  };

  const onDragOver = (e: DragEvent) => {
    if (![...e.dataTransfer.types].includes("Files")) return;
    e.preventDefault();
    setIsDragOver(true);
  };

  const toggleMic = () => {
    if (speech.listening) return speech.stop();
    textBeforeSpeech.current = text;
    speech.start();
  };

  return (
    <form
      className="relative rounded-3xl border border-border bg-background p-2 shadow-xs transition-colors duration-200 focus-within:border-ring"
      onSubmit={onSubmit}
      onDragOver={onDragOver}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setIsDragOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragOver(false);
        addFiles([...e.dataTransfer.files]);
      }}
    >
      <input ref={fileRef} className="sr-only" type="file" accept="image/*" multiple onChange={(e) => (addFiles([...(e.target.files ?? [])]), (e.target.value = ""))} />
      <input ref={cameraRef} className="sr-only" type="file" accept="image/*" capture="environment" onChange={(e) => (addFiles([...(e.target.files ?? [])]), (e.target.value = ""))} />

      {attachments.length > 0 ? (
        <div className="mb-2 flex flex-wrap items-center gap-2 px-1 pt-1">
          {attachments.map((a) => (
            <Badge key={a.id} variant="outline" className="group relative h-8 max-w-40 gap-1.5 overflow-hidden ps-1 pe-6">
              {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview */}
              <img src={a.preview} alt="" className="size-6 rounded-md border border-border object-cover" />
              <span className="truncate text-body-2-regular">{a.name}</span>
              <button
                type="button"
                onClick={() => remove(a.id)}
                aria-label={`Remove ${a.name}`}
                className="absolute end-1 rounded-sm p-0.5 text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              >
                <RiCloseLine className="size-3.5" aria-hidden />
              </button>
            </Badge>
          ))}
        </div>
      ) : null}

      <Textarea
        aria-label="What did you spend?"
        className="max-h-48 min-h-12 resize-none rounded-none border-none bg-transparent! px-2 py-1.5 text-body-regular shadow-none focus-visible:border-transparent focus-visible:ring-0"
        placeholder={speech.listening ? "Listening… speak now" : placeholder}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
      />

      <div className="flex items-center gap-1">
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button aria-label="Add images" className="rounded-full" size="icon-lg" type="button" variant="ghost" />}>
            <RiAddLine className="size-5 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56 rounded-2xl p-1.5">
            <DropdownMenuGroup className="space-y-1">
              <DropdownMenuItem className="rounded-xl px-2.5 py-2" onClick={() => fileRef.current?.click()}>
                <RiImageAddLine className="opacity-60" />
                Receipt or screenshot
              </DropdownMenuItem>
              <DropdownMenuItem className="rounded-xl px-2.5 py-2" onClick={() => cameraRef.current?.click()}>
                <RiCameraLine className="opacity-60" />
                Take a photo
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="ms-auto flex items-center gap-1.5">
          {speech.supported ? (
            <Button
              aria-label={speech.listening ? "Stop listening" : "Speak"}
              aria-pressed={speech.listening}
              className={cn("rounded-full", speech.listening && "animate-pulse bg-destructive/10 text-destructive hover:bg-destructive/20")}
              size="icon-lg"
              type="button"
              variant="ghost"
              onClick={toggleMic}
            >
              {speech.listening ? <RiMicFill className="size-5" /> : <RiMicLine className="size-5 text-muted-foreground" />}
            </Button>
          ) : null}
          <Button aria-label="Send" className="rounded-full disabled:opacity-40" disabled={!canSend} size="icon-lg" type="submit">
            <RiArrowUpLine className="size-5" />
          </Button>
        </div>
      </div>

      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 z-20 flex items-center justify-center gap-2 rounded-[inherit] border border-dashed border-ring bg-muted text-body-medium text-foreground transition-opacity duration-200",
          isDragOver ? "opacity-100" : "opacity-0",
        )}
      >
        <RiImageLine className="size-4" />
        Drop receipts or screenshots
      </div>
    </form>
  );
}
