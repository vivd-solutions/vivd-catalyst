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
    <aside className="acp-rail" aria-label="Conversations">
      <div className="acp-instance">
        <div className="acp-instance-mark">
          {config?.ui.logoUrl ? (
            <img src={config.ui.logoUrl} alt="" />
          ) : (
            <ShieldCheck size={18} aria-hidden="true" />
          )}
        </div>
        <div className="acp-instance-text">
          <strong>{config?.ui.clientName ?? config?.ui.title ?? "Agent Chat"}</strong>
          <span>{user?.displayLabel ?? "Loading"}</span>
        </div>
        {isSuperadmin ? (
          <button
            type="button"
            className={
              view === "superadmin"
                ? "acp-admin-shortcut acp-admin-shortcut-active"
                : "acp-admin-shortcut"
            }
            aria-label={view === "superadmin" ? "Return to chat" : "Open superadmin panel"}
            title={view === "superadmin" ? "Return to chat" : "Open superadmin panel"}
            onClick={() => onViewChange(view === "superadmin" ? "chat" : "superadmin")}
          >
            <Settings size={16} aria-hidden="true" />
          </button>
        ) : null}
        <button
          type="button"
          className="acp-admin-shortcut"
          aria-label="Sign out"
          title="Sign out"
          onClick={onSignOut}
        >
          <LogOut size={16} aria-hidden="true" />
        </button>
      </div>

      <Button
        className="acp-new-button"
        type="button"
        onClick={onCreateConversation}
        disabled={creatingConversation}
      >
        <Plus size={17} aria-hidden="true" />
        <span>New</span>
      </Button>

      <nav className="acp-conversation-list">
        {conversations.map((conversation) => (
          <ConversationButton
            key={conversation.id}
            conversation={conversation}
            selected={conversation.id === selectedConversationId}
            onSelect={() => onSelectConversation(conversation.id)}
            onDelete={() => onDeleteConversation(conversation.id)}
            deleting={deletingConversation}
          />
        ))}
      </nav>
    </aside>
  );
}
