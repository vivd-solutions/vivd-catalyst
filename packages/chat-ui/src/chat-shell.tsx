import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ApiUser, AuditEvent, UsageSummary } from "@agent-chat-platform/api-client";
import { ChatWorkspace } from "./chat-workspace";

export interface ChatShellAdminPanel {
  canView(user: ApiUser | undefined): boolean;
  renderPanel(input: {
    usage: UsageSummary | undefined;
    auditEvents: AuditEvent[];
    loading: boolean;
    error?: string;
  }): ReactNode;
}

export interface ChatShellProps {
  apiBaseUrl: string;
  token?: string;
  getToken?: () => string | undefined | Promise<string | undefined>;
  adminPanel?: ChatShellAdminPanel;
  className?: string;
}

export function ChatShell(props: ChatShellProps) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <ChatWorkspace {...props} />
    </QueryClientProvider>
  );
}
