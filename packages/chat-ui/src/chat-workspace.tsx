import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, createApiClient, type Conversation, type Message } from "@agent-chat-platform/api-client";
import { AssistantChatPanel } from "./assistant-chat-panel";
import { signOut } from "./auth-client";
import type { ChatShellProps } from "./chat-shell";
import { LoginPanel } from "./login-panel";
import { createThemeStyle } from "./theme";
import { cn } from "./ui/cn";
import { type WorkspaceView, WorkspaceRail } from "./workspace-rail";

export function ChatWorkspace({ apiBaseUrl, token, getToken, adminPanel, className }: ChatShellProps) {
  const queryClient = useQueryClient();
  const [selectedConversationId, setSelectedConversationId] = useState<string | undefined>();
  const [draftsByTarget, setDraftsByTarget] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | undefined>();
  const [view, setView] = useState<WorkspaceView>("chat");
  const authScope = "standalone";
  const draftKey = createDraftKey(authScope, selectedConversationId);
  const draft = draftsByTarget[draftKey] ?? "";

  const client = useMemo(
    () =>
      createApiClient({
        baseUrl: apiBaseUrl,
        getToken: getToken ?? (() => token)
      }),
    [apiBaseUrl, getToken, token]
  );

  const meQuery = useQuery({
    queryKey: ["me", apiBaseUrl],
    queryFn: client.me,
    retry: false
  });
  const isAuthenticated = Boolean(meQuery.data);
  const configQuery = useQuery({
    queryKey: ["config", apiBaseUrl, authScope],
    queryFn: client.config,
    enabled: isAuthenticated
  });
  const conversationsQuery = useQuery({
    queryKey: ["conversations", apiBaseUrl, authScope],
    queryFn: client.conversations,
    enabled: isAuthenticated
  });
  const messagesQuery = useQuery({
    queryKey: ["messages", apiBaseUrl, authScope, selectedConversationId],
    queryFn: () => client.messages(selectedConversationId ?? ""),
    enabled: isAuthenticated && Boolean(selectedConversationId)
  });
  const isSuperadmin = adminPanel?.canView(meQuery.data) ?? false;
  const usageQuery = useQuery({
    queryKey: ["usage", apiBaseUrl, authScope],
    queryFn: client.usageSummary,
    enabled: isSuperadmin && view === "superadmin"
  });
  const auditQuery = useQuery({
    queryKey: ["audit-events", apiBaseUrl, authScope],
    queryFn: client.auditEvents,
    enabled: isSuperadmin && view === "superadmin"
  });

  const deleteConversation = useMutation({
    mutationFn: (conversationId: string) => client.deleteConversation(conversationId),
    onSuccess: (deletedConversation) => {
      let nextSelectedConversationId: string | undefined;
      queryClient.setQueryData<Conversation[]>(
        ["conversations", apiBaseUrl, authScope],
        (currentConversations = []) => {
          const remainingConversations = currentConversations.filter(
            (conversation) => conversation.id !== deletedConversation.id
          );
          nextSelectedConversationId =
            !selectedConversationId || selectedConversationId === deletedConversation.id
              ? remainingConversations[0]?.id
              : selectedConversationId;
          return remainingConversations;
        }
      );
      queryClient.removeQueries({ queryKey: ["messages", apiBaseUrl, authScope, deletedConversation.id] });
      setSelectedConversationId(nextSelectedConversationId);
      setNotice(undefined);
      void queryClient.invalidateQueries({ queryKey: ["conversations", apiBaseUrl, authScope] });
    },
    onError: (error) => {
      setNotice(error instanceof ApiError ? error.message : "Delete failed");
    }
  });

  const conversations = conversationsQuery.data ?? [];
  const messages = messagesQuery.data ?? [];
  const config = configQuery.data;
  const themeStyle = createThemeStyle(config?.ui);

  const signOutMutation = useMutation({
    mutationFn: () => signOut(apiBaseUrl),
    onSuccess: () => {
      setSelectedConversationId(undefined);
      setDraftsByTarget({});
      setView("chat");
      void queryClient.clear();
      void queryClient.invalidateQueries({ queryKey: ["me", apiBaseUrl] });
    }
  });

  function onCreateConversation() {
    setSelectedConversationId(undefined);
    setView("chat");
    setNotice(undefined);
  }

  function setDraftForKey(key: string, value: string) {
    setDraftsByTarget((currentDrafts) => {
      if (value.length === 0) {
        const remainingDrafts = { ...currentDrafts };
        delete remainingDrafts[key];
        return remainingDrafts;
      }
      return {
        ...currentDrafts,
        [key]: value
      };
    });
  }

  function onConversationStarted(conversationId: string, startedMessages?: Message[]) {
    if (startedMessages) {
      queryClient.setQueryData(["messages", apiBaseUrl, authScope, conversationId], startedMessages);
    }
    setSelectedConversationId(conversationId);
    setView("chat");
    setNotice(undefined);
    void queryClient.invalidateQueries({ queryKey: ["conversations", apiBaseUrl, authScope] });
  }

  function onStreamFinished() {
    setNotice(undefined);
    void queryClient.invalidateQueries({ queryKey: ["conversations", apiBaseUrl, authScope] });
    void queryClient.invalidateQueries({ queryKey: ["messages", apiBaseUrl, authScope] });
    void queryClient.invalidateQueries({ queryKey: ["usage", apiBaseUrl, authScope] });
    void queryClient.invalidateQueries({ queryKey: ["audit-events", apiBaseUrl, authScope] });
  }

  if (meQuery.error instanceof ApiError && meQuery.error.status === 401) {
    return (
      <LoginPanel
        apiBaseUrl={apiBaseUrl}
        onSignedIn={() => {
          void queryClient.invalidateQueries({ queryKey: ["me", apiBaseUrl] });
        }}
      />
    );
  }

  return (
    <main
      className={cn(
        "grid h-dvh w-full min-h-0 overflow-hidden bg-background text-foreground md:grid-cols-[minmax(230px,286px)_minmax(0,1fr)] md:grid-rows-[minmax(0,1fr)] max-md:grid-cols-1 max-md:grid-rows-[auto_minmax(0,1fr)]",
        className
      )}
      style={themeStyle}
    >
      <WorkspaceRail
        config={config}
        user={meQuery.data}
        conversations={conversations}
        selectedConversationId={selectedConversationId}
        isSuperadmin={isSuperadmin}
        view={view}
        creatingConversation={false}
        deletingConversation={deleteConversation.isPending}
        onViewChange={setView}
        onSignOut={() => signOutMutation.mutate()}
        onCreateConversation={onCreateConversation}
        onSelectConversation={setSelectedConversationId}
        onDeleteConversation={(conversationId) => deleteConversation.mutate(conversationId)}
      />

      {view === "superadmin" && isSuperadmin ? (
        adminPanel?.renderPanel({
          usage: usageQuery.data,
          auditEvents: auditQuery.data ?? [],
          loading: usageQuery.isLoading || auditQuery.isLoading,
          error:
            usageQuery.error instanceof ApiError
              ? usageQuery.error.message
              : auditQuery.error instanceof ApiError
                ? auditQuery.error.message
                : undefined
        })
      ) : (
        <AssistantChatPanel
          apiBaseUrl={apiBaseUrl}
          client={client}
          config={config}
          conversations={conversations}
          selectedConversationId={selectedConversationId}
          messages={messages}
          notice={notice}
          draft={draft}
          onDraftChange={(value) => setDraftForKey(draftKey, value)}
          onConversationStarted={onConversationStarted}
          onStreamFinished={onStreamFinished}
          onStreamError={setNotice}
        />
      )}
    </main>
  );
}

function createDraftKey(authScope: string, conversationId: string | undefined): string {
  return `${authScope}:${conversationId ?? "new"}`;
}
