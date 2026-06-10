import { AuiIf, ThreadPrimitive } from "@assistant-ui/react";
import { ArrowDown, Bot, CircleAlert, Sparkles } from "lucide-react";
import type { Conversation, SafeConfig } from "@agent-chat-platform/api-client";
import { AssistantComposer } from "./assistant-composer";
import { ThreadMessage } from "./assistant-message";
import { currentTitle } from "./conversation-title";
import { Badge } from "./ui/badge";
import { cn } from "./ui/cn";

export function AssistantThread({
  config,
  conversations,
  selectedConversationId,
  notice
}: {
  config: SafeConfig | undefined;
  conversations: Conversation[];
  selectedConversationId: string | undefined;
  notice: string | undefined;
}) {
  const suggestions = createSuggestions(config);

  return (
    <section
      className="grid min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden bg-background"
      aria-label="Chat"
    >
      <header className="flex min-h-16 min-w-0 items-center justify-between gap-4 border-b bg-background/95 px-5 py-3">
        <div className="grid min-w-0 gap-1">
          <span className="truncate text-xs text-muted-foreground">
            {currentTitle(conversations, selectedConversationId)}
          </span>
          <strong className="truncate text-sm font-semibold">{config?.agents[0]?.displayName ?? "Agent"}</strong>
        </div>
        <Badge variant="outline" className="shrink-0 text-muted-foreground">
          <span className="size-2 rounded-full bg-emerald-600" />
          Ready
        </Badge>
      </header>

      <ThreadPrimitive.Root
        className="grid min-h-0 min-w-0 grid-rows-[minmax(0,1fr)] overflow-hidden"
        style={{ ["--thread-max-width" as string]: "48rem" }}
      >
        <ThreadPrimitive.Viewport className="relative flex min-h-0 flex-col overflow-y-auto overflow-x-hidden scroll-smooth">
          <div className="mx-auto flex w-full max-w-[var(--thread-max-width)] flex-1 flex-col px-5 pt-5">
            {notice ? (
              <div className="mb-4 inline-flex w-fit max-w-full items-center gap-2 rounded-md border border-amber-300/70 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                <CircleAlert size={17} aria-hidden="true" />
                <span>{notice}</span>
              </div>
            ) : null}

            <AuiIf condition={(state) => state.thread.isEmpty}>
              <ThreadWelcome config={config} suggestions={suggestions} />
            </AuiIf>

            <div className="flex flex-col gap-5 pb-6 empty:hidden">
              <ThreadPrimitive.Messages>{() => <ThreadMessage />}</ThreadPrimitive.Messages>
            </div>

            <ThreadPrimitive.ViewportFooter className="sticky bottom-0 mt-auto bg-gradient-to-t from-background via-background to-background/80 pb-4 pt-5">
              <AuiIf condition={(state) => !state.thread.isEmpty}>
                <ThreadScrollToBottom />
              </AuiIf>
              <AssistantComposer />
            </ThreadPrimitive.ViewportFooter>
          </div>
        </ThreadPrimitive.Viewport>
      </ThreadPrimitive.Root>
    </section>
  );
}

function ThreadWelcome({
  config,
  suggestions
}: {
  config: SafeConfig | undefined;
  suggestions: Array<{ title: string; prompt: string }>;
}) {
  return (
    <div className="my-auto grid min-h-[20rem] content-center gap-5 py-8">
      <div className="grid gap-3">
        <span className="grid size-10 place-items-center rounded-lg border bg-card text-primary shadow-xs">
          <Bot size={20} aria-hidden="true" />
        </span>
        <div className="grid gap-1">
          <h2 className="text-xl font-semibold tracking-normal">{config?.ui.welcomeMessage ?? "How can I help?"}</h2>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            {config?.agents[0]?.displayName ?? "The agent"} is ready for this conversation.
          </p>
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        {suggestions.map((suggestion) => (
          <ThreadPrimitive.Suggestion
            key={suggestion.title}
            prompt={suggestion.prompt}
            className={cn(
              "group/suggestion grid min-h-20 content-between rounded-md border bg-card p-3 text-left text-sm shadow-xs transition-colors",
              "hover:border-primary/40 hover:bg-accent focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40"
            )}
          >
            <span className="font-medium">{suggestion.title}</span>
            <Sparkles size={15} className="mt-2 text-muted-foreground group-hover/suggestion:text-primary" aria-hidden="true" />
          </ThreadPrimitive.Suggestion>
        ))}
      </div>
    </div>
  );
}

function ThreadScrollToBottom() {
  return (
    <ThreadPrimitive.ScrollToBottom
      className="absolute -top-5 left-1/2 z-10 grid size-9 -translate-x-1/2 place-items-center rounded-full border bg-background text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground disabled:invisible"
      aria-label="Scroll to bottom"
      title="Scroll to bottom"
    >
      <ArrowDown size={16} aria-hidden="true" />
    </ThreadPrimitive.ScrollToBottom>
  );
}

function createSuggestions(config: SafeConfig | undefined): Array<{ title: string; prompt: string }> {
  const agentName = config?.agents[0]?.displayName ?? "agent";
  return [
    {
      title: "Summarize documents",
      prompt: `Help me summarize the documents and identify the next review steps for ${agentName}.`
    },
    {
      title: "Find review risks",
      prompt: "List the most important application or document review risks I should check first."
    },
    {
      title: "Draft questions",
      prompt: "Draft concise follow-up questions for missing or unclear application details."
    }
  ];
}
