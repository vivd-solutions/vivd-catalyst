import { LogOut, Plus, Settings, ShieldCheck } from "lucide-react";
import type { ApiUser, Conversation, SafeConfig } from "@agent-chat-platform/api-client";
import { ConversationButton } from "./conversation-button";
import { Button } from "./ui/button";

export type WorkspaceView = "chat" | "superadmin";

export function WorkspaceRail({
  config,
  user,
  conversations,
  selectedConversationId,
  isSuperadmin,
  view,
  creatingConversation,
  deletingConversation,
  onViewChange,
  onSignOut,
  onCreateConversation,
  onSelectConversation,
  onDeleteConversation
}: {
  config: SafeConfig | undefined;
  user: ApiUser | undefined;
  conversations: Conversation[];
  selectedConversationId: string | undefined;
  isSuperadmin: boolean;
  view: WorkspaceView;
  creatingConversation: boolean;
  deletingConversation: boolean;
  onViewChange: (view: WorkspaceView) => void;
  onSignOut: () => void;
  onCreateConversation: () => void;
  onSelectConversation: (conversationId: string) => void;
  onDeleteConversation: (conversationId: string) => void;
}) {
  return (
    <aside
      className="grid h-full min-h-0 min-w-0 grid-rows-[auto_auto_minmax(0,1fr)] gap-4 overflow-hidden border-r bg-sidebar p-4 text-sidebar-foreground max-md:grid-cols-[minmax(0,1fr)_5.5rem] max-md:grid-rows-[auto_auto] max-md:border-r-0 max-md:border-b"
      aria-label="Conversations"
    >
      <div className="grid min-w-0 grid-cols-[2.25rem_minmax(0,1fr)_auto_auto] items-center gap-2.5 max-md:col-start-1 max-md:row-start-1">
        <div className="grid size-9 place-items-center overflow-hidden rounded-lg border bg-card text-primary">
          {config?.ui.logoUrl ? (
            <img className="size-full object-cover" src={config.ui.logoUrl} alt="" />
          ) : (
            <ShieldCheck size={18} aria-hidden="true" />
          )}
        </div>
        <div className="grid min-w-0 gap-0.5">
          <strong className="truncate text-sm">{config?.ui.clientName ?? config?.ui.title ?? "Agent Chat"}</strong>
          <span className="truncate text-xs text-muted-foreground">{user?.displayLabel ?? "Loading"}</span>
        </div>
        {isSuperadmin ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={view === "superadmin" ? "bg-sidebar-accent text-primary" : "text-muted-foreground"}
            aria-label={view === "superadmin" ? "Return to chat" : "Open superadmin panel"}
            title={view === "superadmin" ? "Return to chat" : "Open superadmin panel"}
            onClick={() => onViewChange(view === "superadmin" ? "chat" : "superadmin")}
          >
            <Settings size={16} aria-hidden="true" />
          </Button>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="text-muted-foreground"
          aria-label="Sign out"
          title="Sign out"
          onClick={onSignOut}
        >
          <LogOut size={16} aria-hidden="true" />
        </Button>
      </div>

      <Button
        className="h-10 w-full justify-center shadow-xs max-md:col-start-2 max-md:row-start-1"
        type="button"
        onClick={onCreateConversation}
        disabled={creatingConversation}
      >
        <Plus size={17} aria-hidden="true" />
        <span>New</span>
      </Button>

      <nav className="grid min-h-0 content-start gap-2 overflow-auto pr-1 max-md:col-span-full max-md:row-start-2 max-md:grid-flow-col max-md:auto-cols-[minmax(12rem,16rem)] max-md:overflow-x-auto max-md:overflow-y-hidden max-md:pr-0">
        {conversations.length === 0 ? (
          <div className="rounded-md border border-dashed bg-sidebar-accent/40 px-3 py-4 text-sm text-muted-foreground">
            No conversations yet.
          </div>
        ) : (
          conversations.map((conversation) => (
            <ConversationButton
              key={conversation.id}
              conversation={conversation}
              selected={conversation.id === selectedConversationId}
              onSelect={() => onSelectConversation(conversation.id)}
              onDelete={() => onDeleteConversation(conversation.id)}
              deleting={deletingConversation}
            />
          ))
        )}
      </nav>
    </aside>
  );
}
