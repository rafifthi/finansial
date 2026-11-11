"use server";

import { Liveblocks } from "@liveblocks/node";
import { z } from "zod";
import { can } from "@/lib/auth/roles";
import { bookAction } from "@/lib/data/action";
import { liveRoom } from "@/lib/library/live";

/**
 * A Liveblocks token for one Library page's room, which carries nothing but
 * where everyone's cursor is and who's typing. The page itself still lives in
 * the sheet. Members who can edit can show their cursor; viewers only watch.
 */
export const liveToken = bookAction(
  null,
  z.object({ room: z.string().max(200) }),
  async ({ room }, { user, book, membership }) => {
    const secret = process.env.LIVEBLOCKS_SECRET_KEY;
    if (!secret) throw new Error("Live cursors aren't set up.");
    const pageId = room.slice(liveRoom(book.id, "").length);
    if (room !== liveRoom(book.id, pageId) || !/^[A-Za-z0-9_-]{1,64}$/.test(pageId)) throw new Error("That page isn't in this book.");
    const session = new Liveblocks({ secret }).prepareSession(user.id, { userInfo: { name: user.name } });
    session.allow(room, can(membership.role, "data:write") ? session.FULL_ACCESS : session.READ_ACCESS);
    const { status, body } = await session.authorize();
    if (status !== 200) throw new Error("Couldn't connect live cursors.");
    return JSON.parse(body) as { token: string };
  },
  { refresh: false },
);
