import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import {
  AssistantRuntimeProvider,
  ComposerPrimitive,
  MessagePartPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  useComposer,
  useComposerRuntime,
  useMessage
} from "@assistant-ui/react";
import { AssistantChatTransport, useChatRuntime } from "@assistant-ui/react-ai-sdk";
import type { UIMessage } from "ai";
import { Bot, CircleAlert, Send, User } from "lucide-react";
import type { ApiClient, Conversation, Message, SafeConfig } from "@agent-chat-platform/api-client";
import { currentTitle, firstLineTitle } from "./conversation-title";

export function AssistantChatPanel({
  apiBaseUrl,
  client,
  config,
  conversations,
  selectedConversationId,
  messages,
  notice,
  draft,
  onDraftChange,
  onConversationStarted,
  onStreamFinished,
  onStreamError
}: {
  apiBaseUrl: string;
  client: ApiClient;
  config: SafeConfig | undefined;
  conversations: Conversation[];
  selectedConversationId: string | undefined;
  messages: Message[];
  notice: string | undefined;
  draft: string;
  onDraftChange: (value: string) => void;
  onConversationStarted: (conversationId: string, messages?: Message[]) => void;
  onStreamFinished: () => void;
  onStreamError: (message: string) => void;
}) {
  const threadKey = selectedConversationId ?? "new";
  const messageHistoryKey = useMemo(() => messages.map((message) => message.id).join(","), [messages]);
  const initialMessages = useMemo(() => toUiMessages(messages), [messages]);
  const pendingConversationIdRef = useRef<string | undefined>(undefined);

  return (
    <AssistantRuntimePane
      key={`${threadKey}:${messageHistoryKey}`}
      apiBaseUrl={apiBaseUrl}
      client={client}
      config={config}
      conversations={conversations}
      selectedConversationId={selectedConversationId}
      initialMessages={initialMessages}
      pendingConversationIdRef={pendingConversationIdRef}
      notice={notice}
      draft={draft}
      onDraftChange={onDraftChange}
      onConversationStarted={onConversationStarted}
      onStreamFinished={onStreamFinished}
      onStreamError={onStreamError}
    />
  );
}

function AssistantRuntimePane({
  apiBaseUrl,
  client,
  config,
  conversations,
  selectedConversationId,
  initialMessages,
  pendingConversationIdRef,
  notice,
  draft,
  onDraftChange,
  onConversationStarted,
  onStreamFinished,
  onStreamError
}: {
  apiBaseUrl: string;
  client: ApiClient;
  config: SafeConfig | undefined;
  conversations: Conversation[];
  selectedConversationId: string | undefined;
  initialMessages: UIMessage[];
  pendingConversationIdRef: MutableRefObject<string | undefined>;
  notice: string | undefined;
  draft: string;
  onDraftChange: (value: string) => void;
  onConversationStarted: (conversationId: string, messages?: Message[]) => void;
  onStreamFinished: () => void;
  onStreamError: (message: string) => void;
}) {
  const transport = useMemo(
    () =>
      new AssistantChatTransport<UIMessage>({
        api: `${apiBaseUrl.replace(/\/$/u, "")}/api/chat`,
        credentials: "include",
        body: {
          conversationId: selectedConversationId,
          agentName: config?.defaultAgentName
        },
        prepareSendMessagesRequest: async (options) => {
          const text = extractLastUserText(options.messages);
          let conversationId = selectedConversationId;
          if (!conversationId) {
            const conversation = await client.createConversation({
              title: firstLineTitle(text)
            });
            conversationId = conversation.id;
            pendingConversationIdRef.current = conversation.id;
          }

          return {
            credentials: "include",
            body: {
              ...options.body,
              conversationId,
              agentName: config?.defaultAgentName,
              messages: options.messages
            }
          };
        }
      }),
    [apiBaseUrl, client, config?.defaultAgentName, pendingConversationIdRef, selectedConversationId]
  );
  async function selectPendingConversation(): Promise<void> {
    const conversationId = pendingConversationIdRef.current;
    if (!conversationId) {
      return;
    }
    pendingConversationIdRef.current = undefined;
    const persistedMessages = await client.messages(conversationId).catch(() => undefined);
    onConversationStarted(conversationId, persistedMessages);
  }

  const runtime = useChatRuntime({
    messages: initialMessages,
    transport,
    async onFinish() {
      await selectPendingConversation();
      onStreamFinished();
    },
    async onError(error) {
      await selectPendingConversation();
      onStreamError(error.message);
    }
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <DraftBridge draftKey={selectedConversationId ?? "new"} draft={draft} onDraftChange={onDraftChange} />
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

        <ThreadPrimitive.Root className="acp-assistant-thread">
          <ThreadPrimitive.Viewport className="acp-messages" autoScroll>
            {notice ? (
              <div className="acp-notice">
                <CircleAlert size={17} aria-hidden="true" />
                <span>{notice}</span>
              </div>
            ) : null}
            <ThreadPrimitive.Empty>
              <div className="acp-empty">
                <Bot size={22} aria-hidden="true" />
                <p>{config?.ui.welcomeMessage ?? "How can I help?"}</p>
              </div>
            </ThreadPrimitive.Empty>
            <ThreadPrimitive.Messages components={{ Message: AssistantMessage }} />
            <ThreadPrimitive.ViewportFooter />
          </ThreadPrimitive.Viewport>
          <Composer />
        </ThreadPrimitive.Root>
      </section>
    </AssistantRuntimeProvider>
  );
}

function AssistantMessage() {
  const role = useMessage((message) => message.role);
  const isUser = role === "user";
  return (
    <MessagePrimitive.Root className={isUser ? "acp-message acp-message-user" : "acp-message acp-message-agent"}>
      <div className="acp-message-icon">
        {isUser ? <User size={15} aria-hidden="true" /> : <Bot size={15} aria-hidden="true" />}
      </div>
      <div className="acp-message-content">
        <MessagePrimitive.Parts components={{ Text: TextPart }} />
      </div>
    </MessagePrimitive.Root>
  );
}

function TextPart() {
  return (
    <p>
      <MessagePartPrimitive.Text />
    </p>
  );
}

function Composer() {
  return (
    <ComposerPrimitive.Root className="acp-composer">
      <ComposerPrimitive.Input placeholder="Message" rows={1} submitMode="enter" />
      <ComposerPrimitive.Send aria-label="Send message">
        <Send size={18} aria-hidden="true" />
      </ComposerPrimitive.Send>
    </ComposerPrimitive.Root>
  );
}

function DraftBridge({
  draftKey,
  draft,
  onDraftChange
}: {
  draftKey: string;
  draft: string;
  onDraftChange: (value: string) => void;
}) {
  const composer = useComposerRuntime();
  const currentText = useComposer((state) => state.text);
  const restoredDraftKeyRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (restoredDraftKeyRef.current === draftKey) {
      return;
    }
    restoredDraftKeyRef.current = draftKey;
    composer.setText(draft);
  }, [composer, draft, draftKey]);

  useEffect(() => {
    if (currentText !== draft) {
      onDraftChange(currentText);
    }
  }, [currentText, draft, onDraftChange]);

  return null;
}

function toUiMessages(messages: Message[]): UIMessage[] {
  return messages
    .filter((message) => message.role === "user" || message.role === "assistant" || message.role === "system")
    .map((message) => ({
      id: message.id,
      role: message.role as UIMessage["role"],
      parts: [
        {
          type: "text",
          text: message.text,
          state: "done"
        }
      ]
    }));
}

function extractLastUserText(messages: UIMessage[]): string {
  const userMessage = messages.findLast((message) => message.role === "user");
  return (
    userMessage?.parts
      .filter((part) => part.type === "text")
      .map((part) => part.text)
      .join("\n")
      .trim() ?? ""
  );
}
