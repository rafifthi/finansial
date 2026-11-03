import type { Book, Membership, Role, User } from "@/lib/sheets/schema";

/** User fields that are safe to send to the browser. */
export type PublicUser = Omit<User, "password_hash">;

export function toPublicUser({ password_hash: _hash, ...user }: User): PublicUser {
  void _hash;
  return user;
}

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

/**
 * Guards for membership changes inside one book: there must always be an
 * admin, and admins can't lock themselves out by accident.
 */
export function membershipChangeProblem(
  members: Membership[],
  actorUserId: string,
  targetUserId: string,
  change: { role?: Role; remove?: boolean },
): string | null {
  const target = members.find((m) => m.user_id === targetUserId);
  if (!target) return "That person isn't in this book.";
  const nextRole = change.role ?? target.role;
  const self = actorUserId === targetUserId;
  if (self && change.remove) return "You can't remove yourself. Ask another admin, or archive the book.";
  if (self && nextRole !== "admin") return "You can't remove your own admin role. Ask another admin.";
  const adminsAfter = members.filter((m) => {
    if (m.user_id === targetUserId) return !change.remove && nextRole === "admin";
    return m.role === "admin";
  }).length;
  if (adminsAfter === 0) return "A book needs at least one admin.";
  return null;
}

/** Personal books belong to their owner alone; nobody else can be added. */
export function inviteProblem(book: Pick<Book, "kind">): string | null {
  return book.kind === "personal" ? "Personal books are private to their owner. Create a Family book to share." : null;
}

/** Guards for system-wide user changes (system admins only). */
export function systemUserChangeProblem(
  users: User[],
  actorId: string,
  targetId: string,
  change: { disabled?: boolean; is_system_admin?: boolean },
): string | null {
  const target = users.find((u) => u.id === targetId);
  if (!target) return "User not found.";
  if (actorId === targetId && change.disabled) return "You can't disable your own account.";
  if (actorId === targetId && change.is_system_admin === false) return "You can't remove your own system-admin access.";
  const adminsAfter = users.filter((u) => {
    const admin = u.id === targetId ? (change.is_system_admin ?? u.is_system_admin) : u.is_system_admin;
    const disabled = u.id === targetId ? (change.disabled ?? u.disabled) : u.disabled;
    return admin && !disabled;
  }).length;
  if (adminsAfter === 0) return "There must be at least one active system admin.";
  return null;
}
