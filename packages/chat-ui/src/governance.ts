import type { ApiUser } from "@agent-chat-platform/api-client";

export function canViewSuperadminPanel(user: ApiUser | undefined): boolean {
  return Boolean(user?.roles.includes("superadmin"));
}
