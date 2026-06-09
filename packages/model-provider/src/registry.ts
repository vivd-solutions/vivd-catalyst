import { AppError, type RuntimeCallContext } from "@agent-chat-platform/chat-core";
import type { ModelCompletion, ModelCompletionRequest, ModelProvider } from "./types";

export class ModelProviderRegistry implements ModelProvider {
  readonly id = "registry";
  private readonly providers = new Map<string, ModelProvider>();

  constructor(providers: ModelProvider[]) {
    for (const provider of providers) {
      this.providers.set(provider.id, provider);
    }
  }

  async complete(
    request: ModelCompletionRequest,
    context: RuntimeCallContext
  ): Promise<ModelCompletion> {
    const provider = this.providers.get(request.providerId);
    if (!provider) {
      throw new AppError("NOT_FOUND", `Model provider '${request.providerId}' is not registered`);
    }
    return provider.complete(request, context);
  }
}
