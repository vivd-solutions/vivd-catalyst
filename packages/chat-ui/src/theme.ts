import type { CSSProperties } from "react";
import type { SafeConfig } from "@agent-chat-platform/api-client";

export function createThemeStyle(ui: SafeConfig["ui"] | undefined): CSSProperties | undefined {
  if (!ui) {
    return undefined;
  }

  return {
    "--acp-accent": ui.theme.accentColor,
    "--acp-accent-strong": ui.theme.accentStrongColor,
    "--acp-ink": ui.theme.textColor,
    "--acp-muted": ui.theme.mutedTextColor,
    "--acp-line": ui.theme.borderColor,
    "--acp-surface": ui.theme.surfaceColor,
    "--acp-page": ui.theme.backgroundColor
  } as CSSProperties;
}
