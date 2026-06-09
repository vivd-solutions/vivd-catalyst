import {
  AppError,
  type ClientInstanceId,
  type ModelUsageEvent,
  type ModelUsageEventInput,
  type ModelUsageEventStore,
  type ModelUsageWindowSummary,
  createModelUsageWindowBounds
} from "@agent-chat-platform/chat-core";
import type { UsageLimitsConfig, UsagePricingConfig } from "@agent-chat-platform/config-schema";

export interface ModelUsageGovernanceOptions {
  store: ModelUsageEventStore;
  limits: UsageLimitsConfig;
  pricing?: UsagePricingConfig;
}

export interface ModelUsageCost {
  currency: string;
  inputCostMicros: number;
  outputCostMicros: number;
  totalCostMicros: number;
  pricingConfigured: boolean;
}

export interface ModelUsageCostSummary extends ModelUsageCost {
  pricedModelCallCount: number;
  unpricedModelCallCount: number;
}

export interface CostedModelUsageWindowSummary extends ModelUsageWindowSummary {
  cost: ModelUsageCostSummary;
}

export interface CostedModelUsageEvent extends ModelUsageEvent {
  cost: ModelUsageCost;
}

export interface UsageSummary {
  generatedAt: string;
  limits: UsageLimitsConfig;
  pricing: UsagePricingConfig;
  today: CostedModelUsageWindowSummary;
  currentMonth: CostedModelUsageWindowSummary;
  allTime: CostedModelUsageWindowSummary;
  recentEvents: CostedModelUsageEvent[];
}

export class ModelUsageGovernance implements ModelUsageEventStore {
  private readonly store: ModelUsageEventStore;
  private readonly limits: UsageLimitsConfig;
  private readonly pricing: UsagePricingConfig;
  private readonly clientLocks = new Map<string, Promise<void>>();

  constructor(options: ModelUsageGovernanceOptions) {
    this.store = options.store;
    this.limits = options.limits;
    this.pricing = options.pricing ?? {
      currency: "USD",
      models: []
    };
  }

  async runModelCall<T>(
    clientInstanceId: ClientInstanceId,
    execute: () => Promise<T>
  ): Promise<T> {
    return this.withClientLock(clientInstanceId, async () => {
      await this.assertAllowed(clientInstanceId);
      return execute();
    });
  }

  appendModelUsageEvent(input: ModelUsageEventInput): Promise<ModelUsageEvent> {
    return this.store.appendModelUsageEvent(input);
  }

  summarizeModelUsageEvents(input: {
    clientInstanceId: ClientInstanceId;
    start?: string;
    end?: string;
  }): Promise<ModelUsageWindowSummary> {
    return this.store.summarizeModelUsageEvents(input);
  }

  listModelUsageEvents(input: {
    clientInstanceId: ClientInstanceId;
    start?: string;
    end?: string;
    limit?: number;
  }): Promise<ModelUsageEvent[]> {
    return this.store.listModelUsageEvents(input);
  }

  async createSummary(input: {
    clientInstanceId: ClientInstanceId;
    now?: Date;
  }): Promise<UsageSummary> {
    const now = input.now ?? new Date();
    const { todayStart, currentMonthStart } = createModelUsageWindowBounds(now);
    const allEvents = await this.store.listModelUsageEvents({
      clientInstanceId: input.clientInstanceId
    });
    const todayEvents = filterEventsByWindow(allEvents, todayStart);
    const currentMonthEvents = filterEventsByWindow(allEvents, currentMonthStart);
    const pricingCatalog = new UsagePricingCatalog(this.pricing);

    return {
      generatedAt: now.toISOString(),
      limits: this.limits,
      pricing: this.pricing,
      today: summarizeCostedEvents(todayEvents, todayStart, undefined, pricingCatalog),
      currentMonth: summarizeCostedEvents(currentMonthEvents, currentMonthStart, undefined, pricingCatalog),
      allTime: summarizeCostedEvents(allEvents, undefined, undefined, pricingCatalog),
      recentEvents: allEvents.slice(0, 25).map((event) => ({
        ...event,
        cost: pricingCatalog.calculateEventCost(event)
      }))
    };
  }

  private async assertAllowed(clientInstanceId: ClientInstanceId): Promise<void> {
    if (!this.limits.modelCallsPerDay && !this.limits.tokensPerDay && !this.limits.tokensPerMonth) {
      return;
    }

    const { todayStart, currentMonthStart } = createModelUsageWindowBounds();
    const today = await this.store.summarizeModelUsageEvents({
      clientInstanceId,
      start: todayStart
    });
    assertDailyLimits(today, this.limits);

    if (this.limits.tokensPerMonth) {
      const currentMonth = await this.store.summarizeModelUsageEvents({
        clientInstanceId,
        start: currentMonthStart
      });
      if (currentMonth.totalTokens >= this.limits.tokensPerMonth) {
        throw new AppError("FORBIDDEN", "Monthly model token usage limit has been reached");
      }
    }
  }

  private async withClientLock<T>(
    clientInstanceId: ClientInstanceId,
    work: () => Promise<T>
  ): Promise<T> {
    const key = clientInstanceId;
    const previous = this.clientLocks.get(key) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    const next = previous.then(() => current);
    this.clientLocks.set(key, next);

    await previous;
    try {
      return await work();
    } finally {
      release();
      if (this.clientLocks.get(key) === next) {
        this.clientLocks.delete(key);
      }
    }
  }
}

function assertDailyLimits(summary: ModelUsageWindowSummary, limits: UsageLimitsConfig): void {
  if (limits.modelCallsPerDay && summary.modelCallCount >= limits.modelCallsPerDay) {
    throw new AppError("FORBIDDEN", "Daily model call usage limit has been reached");
  }

  if (limits.tokensPerDay && summary.totalTokens >= limits.tokensPerDay) {
    throw new AppError("FORBIDDEN", "Daily model token usage limit has been reached");
  }
}

function filterEventsByWindow(
  events: ModelUsageEvent[],
  start: string | undefined,
  end?: string
): ModelUsageEvent[] {
  return events.filter(
    (event) => (!start || event.createdAt >= start) && (!end || event.createdAt < end)
  );
}

function summarizeCostedEvents(
  events: ModelUsageEvent[],
  start: string | undefined,
  end: string | undefined,
  pricingCatalog: UsagePricingCatalog
): CostedModelUsageWindowSummary {
  return events.reduce<CostedModelUsageWindowSummary>(
    (summary, event) => {
      const cost = pricingCatalog.calculateEventCost(event);
      return {
        ...summary,
        modelCallCount: summary.modelCallCount + 1,
        inputTokens: summary.inputTokens + event.inputTokens,
        outputTokens: summary.outputTokens + event.outputTokens,
        totalTokens: summary.totalTokens + event.totalTokens,
        cost: {
          ...summary.cost,
          inputCostMicros: summary.cost.inputCostMicros + cost.inputCostMicros,
          outputCostMicros: summary.cost.outputCostMicros + cost.outputCostMicros,
          totalCostMicros: summary.cost.totalCostMicros + cost.totalCostMicros,
          pricingConfigured: summary.cost.pricingConfigured || cost.pricingConfigured,
          pricedModelCallCount:
            summary.cost.pricedModelCallCount + (cost.pricingConfigured ? 1 : 0),
          unpricedModelCallCount:
            summary.cost.unpricedModelCallCount + (cost.pricingConfigured ? 0 : 1)
        }
      };
    },
    {
      start,
      end,
      modelCallCount: 0,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      cost: pricingCatalog.createEmptySummary()
    }
  );
}

class UsagePricingCatalog {
  private readonly prices: UsagePricingConfig["models"];

  constructor(private readonly pricing: UsagePricingConfig) {
    this.prices = pricing.models;
  }

  createEmptySummary(): ModelUsageCostSummary {
    return {
      ...this.createEmptyCost(this.prices.length > 0),
      pricedModelCallCount: 0,
      unpricedModelCallCount: 0
    };
  }

  calculateEventCost(event: ModelUsageEvent): ModelUsageCost {
    const price = this.prices.find(
      (candidate) => candidate.providerId === event.providerId && candidate.model === event.model
    );
    if (!price) {
      return this.createEmptyCost(false);
    }

    const inputCostMicros = Math.round(event.inputTokens * price.inputPricePerMillionTokens);
    const outputCostMicros = Math.round(event.outputTokens * price.outputPricePerMillionTokens);
    return {
      currency: this.pricing.currency,
      inputCostMicros,
      outputCostMicros,
      totalCostMicros: inputCostMicros + outputCostMicros,
      pricingConfigured: true
    };
  }

  private createEmptyCost(pricingConfigured: boolean): ModelUsageCost {
    return {
      currency: this.pricing.currency,
      inputCostMicros: 0,
      outputCostMicros: 0,
      totalCostMicros: 0,
      pricingConfigured
    };
  }
}
