import type { CSSProperties } from "react";
import type { SafeConfig } from "@agent-chat-platform/api-client";

export function createThemeStyle(ui: SafeConfig["ui"] | undefined): CSSProperties | undefined {
  if (!ui) {
    return undefined;
  }

  return {
    "--background": ui.theme.surfaceColor,
    "--foreground": ui.theme.textColor,
    "--card": ui.theme.surfaceColor,
    "--card-foreground": ui.theme.textColor,
    "--popover": ui.theme.surfaceColor,
    "--popover-foreground": ui.theme.textColor,
    "--primary": ui.theme.accentColor,
    "--primary-foreground": "#ffffff",
    "--secondary": ui.theme.backgroundColor,
    "--secondary-foreground": ui.theme.textColor,
    "--muted": ui.theme.backgroundColor,
    "--muted-foreground": ui.theme.mutedTextColor,
    "--accent": ui.theme.backgroundColor,
    "--accent-foreground": ui.theme.accentStrongColor,
    "--border": ui.theme.borderColor,
    "--input": ui.theme.borderColor,
    "--ring": ui.theme.accentColor,
    "--sidebar": ui.theme.backgroundColor,
    "--sidebar-foreground": ui.theme.textColor,
    "--sidebar-primary": ui.theme.accentColor,
    "--sidebar-primary-foreground": "#ffffff",
    "--sidebar-accent": ui.theme.surfaceColor,
    "--sidebar-accent-foreground": ui.theme.accentStrongColor,
    "--sidebar-border": ui.theme.borderColor,
    "--sidebar-ring": ui.theme.accentColor
  } as CSSProperties;
}
