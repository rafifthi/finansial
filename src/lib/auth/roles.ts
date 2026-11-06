/**
 * Roles and what they may do. Shared by server (enforcement in every server
 * action) and client (hiding controls), so keep it free of server imports.
 */
export type Role = "admin" | "member" | "viewer";

export const ROLE_INFO: Record<Role, { label: string; description: string }> = {
  admin: { label: "Admin", description: "Everything, including users, settings and categories" },
  member: { label: "Member", description: "Add and edit transactions, budgets, savings adjustments, installments, recurring rules and lists" },
  viewer: { label: "Viewer", description: "Read-only access to every page" },
};

export const PERMISSIONS = {
  /** Transactions, budgets, savings adjustments, installments, recurring, reconcile, lists. */
  "data:write": ["admin", "member"],
  /** Categories, household settings. */
  "setup:write": ["admin"],
  /** Create, edit, disable users and reset passwords. */
  "users:manage": ["admin"],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: Role | undefined | null, permission: Permission): boolean {
  return !!role && (PERMISSIONS[permission] as readonly Role[]).includes(role);
}

/** Editable tables (generic entity forms) and the permission each needs. */
export const TABLE_PERMISSION = {
  categories: "setup:write",
  installments: "data:write",
  recurring: "data:write",
} as const satisfies Record<string, Permission>;
