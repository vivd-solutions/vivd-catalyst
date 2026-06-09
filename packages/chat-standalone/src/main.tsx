import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ChatShell } from "@agent-chat-platform/chat-ui";
import "@agent-chat-platform/chat-ui/styles.css";

const apiBaseUrl = import.meta.env.VITE_CHAT_API_URL ?? "http://127.0.0.1:4100";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ChatShell apiBaseUrl={apiBaseUrl} />
  </StrictMode>
);

