"use client";

import { useEffect, useState } from "react";
import type { Editor } from "@tiptap/core";
import { createClient } from "@liveblocks/client";
import { liveToken } from "@/actions/library-live";
import { liveRoom, NOBODY, spotAt, type LiveEvent, type LivePresence, type Peer } from "@/lib/library/live";
import { setPeers } from "./editor/live-cursors";

/**
 * How cursors travel: Liveblocks when the server has a key; in development
 * without one, between tabs of this browser (BroadcastChannel), so the
 * cursors can still be tried out; otherwise not at all.
 */
export type LiveMode = "liveblocks" | "tabs" | "off";

interface Transport {
  publish(presence: LivePresence): void;
  announce(event: LiveEvent): void;
  leave(): void;
}

interface Handlers {
  peers: (peers: Peer[]) => void;
  event: (event: LiveEvent) => void;
}

function liveblocks(bookId: string, room: string, on: Handlers): Transport {
  const client = createClient({
    throttle: 80,
    authEndpoint: async () => {
      const res = await liveToken(bookId, { room });
      return res.ok && res.data ? { token: res.data.token } : { error: "forbidden", reason: res.ok ? "No token" : res.error };
    },
  });
  const { room: r, leave } = client.enterRoom<LivePresence, Record<string, never>, LiveEvent>(room, { initialPresence: NOBODY });
  const offOthers = r.subscribe("others", (others) =>
    on.peers(
      others.map((o) => ({
        key: String(o.connectionId),
        userId: o.id ?? String(o.connectionId),
        name: (o.info as { name?: string } | undefined)?.name ?? "Someone",
        presence: o.presence,
      })),
    ),
  );
  const offEvents = r.subscribe("event", ({ event }) => on.event(event));
  return {
    publish: (p) => r.updatePresence(p),
    announce: (e) => r.broadcastEvent(e),
    leave: () => {
      offOthers();
      offEvents();
      leave();
    },
  };
}

type TabMessage =
  | { t: "hello"; key: string }
  | { t: "presence"; peer: Peer }
  | { t: "bye"; key: string }
  | { t: "event"; event: LiveEvent };

function tabs(room: string, me: { id: string; name: string }, on: Handlers): Transport {
  const channel = new BroadcastChannel(room);
  const key = crypto.randomUUID();
  const peers = new Map<string, Peer>();
  let mine: LivePresence = NOBODY;
  const send = (m: TabMessage) => channel.postMessage(m);
  const self = (): Peer => ({ key, userId: me.id, name: `${me.name} (other tab)`, presence: mine });
  channel.onmessage = ({ data }: MessageEvent<TabMessage>) => {
    if (data.t === "hello") send({ t: "presence", peer: self() });
    else if (data.t === "presence") peers.set(data.peer.key, data.peer);
    else if (data.t === "bye") peers.delete(data.key);
    else return on.event(data.event);
    on.peers([...peers.values()]);
  };
  send({ t: "hello", key });
  return {
    publish: (p) => {
      mine = p;
      send({ t: "presence", peer: self() });
    },
    announce: (event) => send({ t: "event", event }),
    leave: () => {
      send({ t: "bye", key });
      channel.close();
    },
  };
}

/** Stops showing "typing" this long after the last key. */
const TYPING_MS = 1_500;

/**
 * This person's side of the page's live room: their caret and typing go out,
 * everyone else's come in and are drawn in the editor. When someone saves,
 * the others are told, so they fetch the page then instead of on the next poll.
 */
export class LiveSession {
  private transport: Transport | null = null;
  private presence: LivePresence = NOBODY;
  private typingTimer: number | undefined;
  private onSaved: (event: LiveEvent) => void = () => {};
  /** The person whose save last came in, for colouring what they typed. */
  lastSaver = "";

  constructor(
    private readonly mode: LiveMode,
    private readonly bookId: string,
    private readonly pageId: string,
  ) {}

  /** Who's here now (for the header), and what to do when one of them saves. */
  listen(onPeers: (peers: Peer[]) => void, onSaved: (event: LiveEvent) => void, editor: Editor, me: { id: string; name: string }, canEdit: boolean) {
    this.onSaved = onSaved;
    if (this.mode === "off") return () => {};
    const room = liveRoom(this.bookId, this.pageId);
    const handlers: Handlers = {
      peers: (peers) => {
        setPeers(editor, peers);
        onPeers(peers);
      },
      event: (event) => this.onSaved(event),
    };
    this.transport = this.mode === "liveblocks" ? liveblocks(this.bookId, room, handlers) : tabs(room, me, handlers);
    if (!canEdit) return () => this.stop();

    const where = () => {
      const { anchor, head } = editor.state.selection;
      return { head: spotAt(editor.state.doc, head), anchor: spotAt(editor.state.doc, anchor) };
    };
    const onSelection = () => editor.isFocused && this.publish({ ...this.presence, ...where() });
    const onUpdate = ({ transaction }: { transaction: { docChanged: boolean; getMeta: (k: string) => unknown } }) => {
      if (!transaction.docChanged || transaction.getMeta("addToHistory") === false) return;
      window.clearTimeout(this.typingTimer);
      this.typingTimer = window.setTimeout(() => this.publish({ ...this.presence, typing: false }), TYPING_MS);
      this.publish({ ...where(), typing: true });
    };
    const onFocus = () => this.publish({ ...where(), typing: false });
    // A hidden tab isn't anywhere on the page.
    const onVisibility = () => (document.visibilityState === "hidden" ? this.publish(NOBODY) : editor.isFocused && onFocus());
    editor.on("selectionUpdate", onSelection);
    editor.on("transaction", onUpdate);
    editor.on("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      editor.off("selectionUpdate", onSelection);
      editor.off("transaction", onUpdate);
      editor.off("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      this.stop();
    };
  }

  private publish(p: LivePresence) {
    this.presence = p;
    this.transport?.publish(p);
  }

  private stop() {
    window.clearTimeout(this.typingTimer);
    this.transport?.leave();
    this.transport = null;
  }

  announce(event: LiveEvent) {
    this.transport?.announce(event);
  }

  heardSave(by: string) {
    this.lastSaver = by;
  }
}

/** The page's live session; made before the editor so saves can announce themselves. */
export function useLiveSession(mode: LiveMode, bookId: string, pageId: string) {
  const [session] = useState(() => new LiveSession(mode, bookId, pageId));
  return session;
}

/** Joins the page's room once the editor exists; returns who else is here. */
export function useLiveRoom({
  session,
  editor,
  me,
  canEdit,
  onSaved,
}: {
  session: LiveSession;
  editor: Editor | null;
  me: { id: string; name: string };
  canEdit: boolean;
  onSaved: () => void;
}) {
  const [peers, setPeerList] = useState<Peer[]>([]);
  const { id, name } = me;
  useEffect(() => {
    if (!editor) return;
    return session.listen(
      setPeerList,
      (event) => {
        if (event.type !== "saved") return;
        session.heardSave(event.by);
        onSaved();
      },
      editor,
      { id, name },
      canEdit,
    );
  }, [session, editor, id, name, canEdit, onSaved]);
  return peers;
}
