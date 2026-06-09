import type { ClientInstanceConfig } from "./schemas";

export interface ClientBranding {
  clientName: string;
  logoUrl?: string;
  title: string;
  welcomeMessage: string;
  accentColor: string;
  theme: {
    accentColor: string;
    accentStrongColor: string;
    backgroundColor: string;
    surfaceColor: string;
    textColor: string;
    mutedTextColor: string;
    borderColor: string;
  };
}

export function createClientBranding(config: ClientInstanceConfig): ClientBranding {
  const accentColor = config.ui.theme.accentColor ?? config.ui.accentColor;
  return {
    clientName: config.ui.clientName ?? config.clientInstance.displayName,
    logoUrl: config.ui.logoUrl,
    title: config.ui.title,
    welcomeMessage: config.ui.welcomeMessage,
    accentColor,
    theme: {
      ...config.ui.theme,
      accentColor
    }
  };
}
