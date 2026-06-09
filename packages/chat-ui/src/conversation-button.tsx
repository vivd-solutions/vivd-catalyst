import { MessageSquare, Trash2 } from "lucide-react";
import type { Conversation } from "@agent-chat-platform/api-client";

export function ConversationButton({
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
      <button
        type="button"
        onClick={onDelete}
        disabled={deleting}
        aria-label={`Delete conversation ${conversation.title}`}
      >
        <Trash2 size={15} aria-hidden="true" />
      </button>
    </div>
  );
}
