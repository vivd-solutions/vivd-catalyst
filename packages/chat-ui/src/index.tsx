import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
  useQueryClient
} from "@tanstack/react-query";
import {
  Bot,
  CircleAlert,
  MessageSquare,
  Plus,
  Send,
  ShieldCheck,
  Trash2,
  User
} from "lucide-react";
import {
  ApiError,
  type Conversation,
  type Message,
  createApiClient
} from "@agent-chat-platform/api-client";

export interface ChatShellProps {
  apiBaseUrl: string;
  token?: string;
  getToken?: () => string | undefined | Promise<string | undefined>;
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

function ChatWorkspace({ apiBaseUrl, token, getToken, className }: ChatShellProps) {
  const queryClient = useQueryClient();
  const [selectedConversationId, setSelectedConversationId] = useState<string | undefined>();
  const [draft, setDraft] = useState("");
  const [notice, setNotice] = useState<string | undefined>();

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
    queryFn: client.me
  });
  const configQuery = useQuery({
    queryKey: ["config", apiBaseUrl],
    queryFn: client.config
  });
  const conversationsQuery = useQuery({
    queryKey: ["conversations", apiBaseUrl],
    queryFn: client.conversations
  });
  const messagesQuery = useQuery({
    queryKey: ["messages", apiBaseUrl, selectedConversationId],
    queryFn: () => client.messages(selectedConversationId ?? ""),
    enabled: Boolean(selectedConversationId)
  });

  useEffect(() => {
    if (!selectedConversationId && conversationsQuery.data?.[0]) {
      setSelectedConversationId(conversationsQuery.data[0].id);
    }
  }, [conversationsQuery.data, selectedConversationId]);

  const createConversation = useMutation({
    mutationFn: () => client.createConversation({ title: "New conversation" }),
    onSuccess: (conversation) => {
      setSelectedConversationId(conversation.id);
      void queryClient.invalidateQueries({ queryKey: ["conversations", apiBaseUrl] });
    }
  });

  const sendMessage = useMutation({
    mutationFn: async (text: string) => {
      const conversationId =
        selectedConversationId ?? (await client.createConversation({ title: firstLineTitle(text) })).id;
      setSelectedConversationId(conversationId);
      return client.sendMessage(conversationId, {
        agentName: configQuery.data?.defaultAgentName,
        text
      });
    },
    onSuccess: () => {
      setDraft("");
      setNotice(undefined);
      void queryClient.invalidateQueries({ queryKey: ["conversations", apiBaseUrl] });
      void queryClient.invalidateQueries({ queryKey: ["messages", apiBaseUrl, selectedConversationId] });
    },
    onError: (error) => {
      setNotice(error instanceof ApiError ? error.message : "Message failed");
    }
  });

  const deleteConversation = useMutation({
    mutationFn: (conversationId: string) => client.deleteConversation(conversationId),
    onSuccess: () => {
      setSelectedConversationId(undefined);
      void queryClient.invalidateQueries({ queryKey: ["conversations", apiBaseUrl] });
    },
    onError: (error) => {
      setNotice(error instanceof ApiError ? error.message : "Delete failed");
    }
  });

  const conversations = conversationsQuery.data ?? [];
  const messages = messagesQuery.data ?? [];
  const config = configQuery.data;

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || sendMessage.isPending) {
      return;
    }
    sendMessage.mutate(text);
  }

  return (
    <main className={["acp-shell", className].filter(Boolean).join(" ")}>
      <aside className="acp-rail" aria-label="Conversations">
        <div className="acp-instance">
          <div className="acp-instance-mark">
            <ShieldCheck size={18} aria-hidden="true" />
          </div>
          <div className="acp-instance-text">
            <strong>{config?.ui.title ?? "Agent Chat"}</strong>
            <span>{meQuery.data?.displayLabel ?? "Loading"}</span>
          </div>
        </div>

        <button
          className="acp-new-button"
          type="button"
          onClick={() => createConversation.mutate()}
          disabled={createConversation.isPending}
        >
          <Plus size={17} aria-hidden="true" />
          <span>New</span>
        </button>

        <nav className="acp-conversation-list">
          {conversations.map((conversation) => (
            <ConversationButton
              key={conversation.id}
              conversation={conversation}
              selected={conversation.id === selectedConversationId}
              onSelect={() => setSelectedConversationId(conversation.id)}
              onDelete={() => deleteConversation.mutate(conversation.id)}
              deleting={deleteConversation.isPending}
            />
          ))}
        </nav>
      </aside>

      <section className="acp-chat" aria-label="Chat">
        <header className="acp-chat-header">
          <div>
            <span>{currentTitle(conversations, selectedConversationId)}</span>
            <strong>{config?.agents[0]?.displayName ?? "Agent"}</strong>
          </div>
          <div className="acp-status">
            <span />
            Ready
          </div>
        </header>

        <div className="acp-messages" aria-live="polite">
          {notice ? (
            <div className="acp-notice">
              <CircleAlert size={17} aria-hidden="true" />
              <span>{notice}</span>
            </div>
          ) : null}

          {messages.length === 0 ? (
            <div className="acp-empty">
              <Bot size={22} aria-hidden="true" />
              <p>{config?.ui.welcomeMessage ?? "How can I help?"}</p>
            </div>
          ) : (
            messages.map((message) => <MessageBubble key={message.id} message={message} />)
          )}

          {sendMessage.isPending ? (
            <div className="acp-pending">
              <span />
              Thinking
            </div>
          ) : null}
        </div>

        <form className="acp-composer" onSubmit={onSubmit}>
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Message"
            rows={1}
          />
          <button type="submit" disabled={!draft.trim() || sendMessage.isPending} aria-label="Send message">
            <Send size={18} aria-hidden="true" />
          </button>
        </form>
      </section>
    </main>
  );
}

function ConversationButton({
  conversation,
  selected,
  onSelect,
  onDelete,
  deleting
}: {
  conversation: Conversation;
  selected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  deleting: boolean;
}) {
  return (
    <div className={selected ? "acp-conversation acp-conversation-selected" : "acp-conversation"}>
      <button type="button" onClick={onSelect}>
        <MessageSquare size={16} aria-hidden="true" />
        <span>{conversation.title}</span>
      </button>
      <button type="button" onClick={onDelete} disabled={deleting} aria-label="Delete conversation">
        <Trash2 size={15} aria-hidden="true" />
      </button>
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";
  return (
    <article className={isUser ? "acp-message acp-message-user" : "acp-message acp-message-agent"}>
      <div className="acp-message-icon">
        {isUser ? <User size={15} aria-hidden="true" /> : <Bot size={15} aria-hidden="true" />}
      </div>
      <p>{message.text}</p>
    </article>
  );
}

function currentTitle(conversations: Conversation[], selectedConversationId: string | undefined): string {
  return (
    conversations.find((conversation) => conversation.id === selectedConversationId)?.title ??
    "Conversation"
  );
}

function firstLineTitle(text: string): string {
  const firstLine = text.split("\n")[0]?.trim() ?? "New conversation";
  return firstLine.length > 60 ? `${firstLine.slice(0, 57)}...` : firstLine || "New conversation";
}

