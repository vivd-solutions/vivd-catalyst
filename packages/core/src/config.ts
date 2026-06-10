export interface DeterministicModelProviderConfig {
  id: string;
  type: "deterministic";
  model: string;
}

export interface OpenAiCompatibleModelProviderConfig {
  id: string;
  type: "openai-compatible";
  model: string;
  baseUrl: string;
  apiKeyEnvName: string;
  organizationEnvName?: string;
}

export type ModelProviderConfig =
  | DeterministicModelProviderConfig
  | OpenAiCompatibleModelProviderConfig;

export interface AgentConfig {
  name: string;
  displayName: string;
  instructions: string;
  modelProviderId?: string;
  toolNames: string[];
}

export interface UsageLimitsConfig {
  modelCallsPerDay?: number;
  tokensPerDay?: number;
  tokensPerMonth?: number;
}

export interface UsagePricingModelConfig {
  providerId: string;
  model: string;
  inputPricePerMillionTokens: number;
  outputPricePerMillionTokens: number;
}

export interface UsagePricingConfig {
  currency: string;
  models: UsagePricingModelConfig[];
}
