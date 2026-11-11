"use server";

import { Liveblocks } from "@liveblocks/node";
import { z } from "zod";
import { can } from "@/lib/auth/roles";
import { bookAction, FieldErrors } from "@/lib/data/action";
import { liveRoom } from "@/lib/library/live";
import { keyHint, LIVE_KEY_SETTING, liveKey, sealSecret } from "@/lib/library/live-key";

/**
 * A Liveblocks token for one Library page's room, which carries nothing but
 * where everyone's cursor is and who's typing. The page itself still lives in
 * the sheet. Members who can edit can show their cursor; viewers only watch.
 */
export const liveToken = bookAction(
  null,
  z.object({ room: z.string().max(200) }),
  async ({ room }, { user, book, membership, store }) => {
    const { key } = await liveKey(store);
    if (!key) throw new Error("Live cursors aren't set up.");
    const pageId = room.slice(liveRoom(book.id, "").length);
    if (room !== liveRoom(book.id, pageId) || !/^[A-Za-z0-9_-]{1,64}$/.test(pageId)) throw new Error("That page isn't in this book.");
    const session = new Liveblocks({ secret: key }).prepareSession(user.id, { userInfo: { name: user.name } });
    session.allow(room, can(membership.role, "data:write") ? session.FULL_ACCESS : session.READ_ACCESS);
    const { status, body } = await session.authorize();
    if (status !== 200) throw new Error("Couldn't connect live cursors.");
    return JSON.parse(body) as { token: string };
  },
  { refresh: false },
);

/**
 * Sets (or, with an empty key, removes) this book's Liveblocks key. The key
 * is tried against Liveblocks first, so a typo shows here rather than as
 * cursors that never appear.
 */
export const saveLiveKey = bookAction("setup:write", z.object({ key: z.string().trim().max(200) }), async ({ key }, { store }) => {
  if (!key) {
    await store.setSetting(LIVE_KEY_SETTING, "");
    return { hint: "" };
  }
  if (!key.startsWith("sk_")) throw new FieldErrors({ key: "Use the secret key: it starts with sk_ (not the public pk_ one)." });
  try {
    await new Liveblocks({ secret: key }).getRooms({ limit: 1 });
  } catch {
    throw new FieldErrors({ key: "Liveblocks didn't accept this key. Copy it again from the project's API keys page." });
  }
  await store.setSetting(LIVE_KEY_SETTING, sealSecret(key));
  return { hint: keyHint(key) };
});
