import { type FormEvent, useLayoutEffect, useRef } from "react";
import { Bot, CircleAlert, Send } from "lucide-react";
import type { Conversation, Message, SafeConfig } from "@agent-chat-platform/api-client";
import { currentTitle } from "./conversation-title";
import { MessageBubble } from "./message-bubble";

export function ChatPanel({
  config,
  conversations,
  selectedConversationId,
  messages,
  notice,
  draft,
  sending,
  onDraftChange,
  onSubmit
}: {
  config: SafeConfig | undefined;
  conversations: Conversation[];
  selectedConversationId: string | undefined;
  messages: Message[];
  notice: string | undefined;
  draft: string;
  sending: boolean;
  onDraftChange: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
}) {
  const composerFormRef = useRef<HTMLFormElement>(null);
  const composerInputRef = useRef<HTMLTextAreaElement>(null);
  const shiftPressedRef = useRef(false);

  useLayoutEffect(() => {
    const composerInput = composerInputRef.current;
    if (!composerInput) {
      return;
    }

    composerInput.style.height = "auto";
    const borderHeight = composerInput.offsetHeight - composerInput.clientHeight;
    composerInput.style.height = `${composerInput.scrollHeight + borderHeight}px`;
  }, [draft]);

  useLayoutEffect(() => {
    const composerForm = composerFormRef.current;
    const composerInput = composerInputRef.current;
    if (!composerForm || !composerInput) {
      return;
    }
    const form = composerForm;
    const input = composerInput;

    function onWindowKeyDown(event: KeyboardEvent) {
      if (event.key === "Shift") {
        shiftPressedRef.current = true;
      }
    }

    function onWindowKeyUp(event: KeyboardEvent) {
      if (event.key === "Shift") {
        shiftPressedRef.current = false;
      }
    }

    function onWindowBlur() {
      shiftPressedRef.current = false;
    }

    function onComposerKeyDown(event: KeyboardEvent) {
      if (event.key !== "Enter" || event.isComposing) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      const hasModifier =
        event.shiftKey ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.getModifierState("Shift") ||
        shiftPressedRef.current;

      if (hasModifier) {
        const selectionStart = input.selectionStart;
        const selectionEnd = input.selectionEnd;
        const nextValue = `${input.value.slice(0, selectionStart)}\n${input.value.slice(selectionEnd)}`;

        onDraftChange(nextValue);
        requestAnimationFrame(() => {
          input.setSelectionRange(selectionStart + 1, selectionStart + 1);
        });
        return;
      }

      input.form?.requestSubmit();
    }

    window.addEventListener("keydown", onWindowKeyDown, { capture: true });
    window.addEventListener("keyup", onWindowKeyUp, { capture: true });
    window.addEventListener("blur", onWindowBlur);
    form.addEventListener("keydown", onComposerKeyDown, { capture: true });

    return () => {
      window.removeEventListener("keydown", onWindowKeyDown, { capture: true });
      window.removeEventListener("keyup", onWindowKeyUp, { capture: true });
      window.removeEventListener("blur", onWindowBlur);
      form.removeEventListener("keydown", onComposerKeyDown, { capture: true });
    };
  }, [onDraftChange]);

  return (
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

        {sending ? (
          <div className="acp-pending">
            <span />
            Thinking
          </div>
        ) : null}
      </div>

      <form ref={composerFormRef} className="acp-composer" onSubmit={onSubmit}>
        <textarea
          ref={composerInputRef}
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          placeholder="Message"
          rows={1}
        />
        <button type="submit" disabled={!draft.trim() || sending} aria-label="Send message">
          <Send size={18} aria-hidden="true" />
        </button>
      </form>
    </section>
  );
}
