import { Bot, User } from "lucide-react";
import type { Message } from "@agent-chat-platform/api-client";

export function MessageBubble({ message }: { message: Message }) {
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
