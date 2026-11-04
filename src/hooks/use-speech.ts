"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

/** The slice of the Web Speech API this hook uses (not in TypeScript's DOM lib). */
interface Recognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

type RecognitionCtor = new () => Recognition;

const noopSubscribe = () => () => {};

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/**
 * Speech to text in the browser (Chrome, Edge, Safari incl. iOS; not
 * Firefox). `onText` gets the running transcript of the current take:
 * finished phrases plus the phrase being spoken.
 */
export function useSpeech({ lang, onText, onError }: { lang: string; onText: (text: string) => void; onError?: (message: string) => void }) {
  // Known only in the browser; false while server rendering.
  const supported = useSyncExternalStore(noopSubscribe, () => recognitionCtor() !== null, () => false);
  const [listening, setListening] = useState(false);
  const rec = useRef<Recognition | null>(null);
  const callbacks = useRef({ onText, onError });
  useEffect(() => {
    callbacks.current = { onText, onError };
  });
  useEffect(() => () => rec.current?.stop(), []);

  const start = useCallback(() => {
    const Ctor = recognitionCtor();
    if (!Ctor) return;
    const r = new Ctor();
    r.lang = lang;
    r.interimResults = true;
    r.continuous = true;
    let finished = "";
    r.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) finished += res[0].transcript;
        else interim += res[0].transcript;
      }
      callbacks.current.onText((finished + interim).trim());
    };
    r.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") callbacks.current.onError?.("Allow microphone access to talk.");
      else if (e.error !== "aborted" && e.error !== "no-speech") callbacks.current.onError?.("Couldn't hear that. Try again.");
    };
    r.onend = () => setListening(false);
    rec.current = r;
    r.start();
    setListening(true);
  }, [lang]);

  const stop = useCallback(() => rec.current?.stop(), []);

  return { supported, listening, start, stop };
}
