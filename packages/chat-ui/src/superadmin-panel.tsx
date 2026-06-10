import {
  Activity,
  AlertCircle,
  BarChart3,
  Clock3,
  Database,
  DollarSign,
  ShieldCheck
} from "lucide-react";
import type { ReactNode } from "react";
import type { AuditEvent, UsageSummary } from "@agent-chat-platform/api-client";
import { Badge } from "./ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { cn } from "./ui/cn";

export function SuperadminPanel({
  usage,
  auditEvents,
  loading,
  error
}: {
  usage: UsageSummary | undefined;
  auditEvents: AuditEvent[];
  loading: boolean;
  error?: string;
}) {
  return (
    <section
      className="grid min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden bg-background"
      aria-label="Superadmin panel"
    >
      <header className="flex min-h-16 min-w-0 items-center justify-between gap-4 border-b px-5 py-3">
        <div className="grid min-w-0 gap-1">
          <span className="truncate text-xs text-muted-foreground">Superadmin</span>
          <strong className="truncate text-sm font-semibold">Usage and governance</strong>
        </div>
        <Badge variant="outline" className="shrink-0 text-muted-foreground">
          <span className="size-2 rounded-full bg-emerald-600" />
          {loading ? "Loading" : "Live"}
        </Badge>
      </header>

      <div className="grid min-h-0 content-start gap-4 overflow-auto bg-background p-5">
        {error ? (
          <div className="inline-flex w-fit max-w-[min(42rem,100%)] items-center gap-2 rounded-md border border-amber-300/70 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <AlertCircle size={17} aria-hidden="true" />
            <span>{error}</span>
          </div>
        ) : null}

        <div className="grid gap-3 lg:grid-cols-4">
          <UsageMetric
            primary
            icon={<DollarSign size={17} />}
            label="Cost today"
            value={formatCost(usage?.today.cost)}
            detail={formatCostDetail(usage?.today.cost)}
          />
          <UsageMetric
            icon={<DollarSign size={17} />}
            label="Cost this month"
            value={formatCost(usage?.currentMonth.cost)}
            detail={formatCostDetail(usage?.currentMonth.cost)}
          />
          <UsageMetric
            icon={<DollarSign size={17} />}
            label="All-time cost"
            value={formatCost(usage?.allTime.cost)}
            detail={formatCostDetail(usage?.allTime.cost)}
          />
        </div>

        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-base">Usage volume</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-2">
            <dl className="grid gap-3 md:grid-cols-3">
              <UsageStat
                icon={<Activity size={15} />}
                label="Calls today"
                value={usage?.today.modelCallCount ?? 0}
              />
              <UsageStat
                icon={<BarChart3 size={15} />}
                label="Tokens today"
                value={usage?.today.totalTokens ?? 0}
              />
              <UsageStat
                icon={<Database size={15} />}
                label="Tokens this month"
                value={usage?.currentMonth.totalTokens ?? 0}
              />
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-base">Configured pricing</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-2">
            {usage?.pricing.models.length ? (
              <dl className="grid gap-3 md:grid-cols-3">
                {usage.pricing.models.map((price) => (
                  <UsagePricing
                    key={`${price.providerId}:${price.model}`}
                    currency={usage.pricing.currency}
                    label={`${price.providerId} / ${price.model}`}
                    inputPrice={price.inputPricePerMillionTokens}
                    outputPrice={price.outputPricePerMillionTokens}
                  />
                ))}
              </dl>
            ) : (
              <p className="text-sm text-muted-foreground">No model pricing configured.</p>
            )}
          </CardContent>
        </Card>

        <Card data-testid="configured-limits">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-base">Configured limits</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-2">
            <dl className="grid gap-3 md:grid-cols-3">
              <UsageStat
                icon={<ShieldCheck size={15} />}
                label="Model calls per day"
                value={usage?.limits.modelCallsPerDay}
              />
              <UsageStat
                icon={<ShieldCheck size={15} />}
                label="Tokens per day"
                value={usage?.limits.tokensPerDay}
              />
              <UsageStat
                icon={<ShieldCheck size={15} />}
                label="Tokens per month"
                value={usage?.limits.tokensPerMonth}
              />
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-base">Recent model usage</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-2">
            <div className="grid gap-2">
              {(usage?.recentEvents ?? []).map((event) => (
                <div
                  key={event.id}
                  className="grid gap-2 rounded-md border bg-card p-3 text-sm md:grid-cols-[1.4fr_1fr_0.8fr_0.8fr_0.8fr]"
                >
                  <span className="text-muted-foreground">
                    {new Date(event.createdAt).toLocaleString()}
                  </span>
                  <strong className="break-words">{event.model}</strong>
                  <strong>{formatCost(event.cost)}</strong>
                  <span className="text-muted-foreground">
                    {event.totalTokens.toLocaleString()} tokens
                  </span>
                  <span className="text-muted-foreground">{event.source}</span>
                </div>
              ))}
              {usage?.recentEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground">No model usage recorded yet.</p>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-base">Recent audit events</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-2">
            <div className="grid gap-2">
              {auditEvents.slice(0, 8).map((event) => (
                <div
                  key={event.id}
                  className="grid gap-2 rounded-md border bg-card p-3 text-sm md:grid-cols-[1.4fr_1fr_0.6fr_1fr]"
                >
                  <span className="text-muted-foreground">
                    {new Date(event.createdAt).toLocaleString()}
                  </span>
                  <strong className="break-words">{event.type}</strong>
                  <span className="text-muted-foreground">{event.status}</span>
                  <span className="break-words text-muted-foreground">{event.subject ?? ""}</span>
                </div>
              ))}
              {auditEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground">No audit events visible yet.</p>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

function UsageMetric({
  icon,
  label,
  value,
  detail,
  primary = false
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  detail?: string;
  primary?: boolean;
}) {
  return (
    <Card className={cn("grid gap-2 p-4", primary && "lg:col-span-2")}>
      <div className="grid size-8 place-items-center rounded-md bg-accent text-primary">{icon}</div>
      <span className="text-xs text-muted-foreground">{label}</span>
      <strong className={cn("break-words text-2xl font-semibold", primary && "text-3xl")}>{value}</strong>
      {detail ? <small className="text-xs text-muted-foreground">{detail}</small> : null}
    </Card>
  );
}

function UsageStat({
  icon,
  label,
  value
}: {
  icon: ReactNode;
  label: string;
  value: number | undefined;
}) {
  return (
    <div className="rounded-md border bg-card p-3">
      <dt className="inline-flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        {label}
      </dt>
      <dd className="mt-1 font-medium">
        {value === undefined ? "Not configured" : value.toLocaleString()}
      </dd>
    </div>
  );
}

function UsagePricing({
  currency,
  label,
  inputPrice,
  outputPrice
}: {
  currency: string;
  label: string;
  inputPrice: number;
  outputPrice: number;
}) {
  return (
    <div className="rounded-md border bg-card p-3">
      <dt className="inline-flex items-center gap-2 break-words text-xs text-muted-foreground">
        <DollarSign size={15} aria-hidden="true" />
        {label}
      </dt>
      <dd className="mt-1 text-sm font-medium">
        {formatCurrencyAmount(inputPrice, currency)} in / 1M,{" "}
        {formatCurrencyAmount(outputPrice, currency)} out / 1M
      </dd>
    </div>
  );
}

type UsageCost = UsageSummary["today"]["cost"] | UsageSummary["recentEvents"][number]["cost"];

function formatCost(cost: UsageCost | undefined): string {
  if (!cost) {
    return "Not configured";
  }

  if (
    "pricedModelCallCount" in cost &&
    cost.pricedModelCallCount === 0 &&
    cost.unpricedModelCallCount > 0
  ) {
    return "No price";
  }

  if (!cost.pricingConfigured) {
    return "Not configured";
  }

  return formatCurrencyMicros(cost.totalCostMicros, cost.currency);
}

function formatCostDetail(cost: UsageSummary["today"]["cost"] | undefined): string | undefined {
  if (!cost?.unpricedModelCallCount) {
    return undefined;
  }
  return `${cost.unpricedModelCallCount.toLocaleString()} unpriced ${
    cost.unpricedModelCallCount === 1 ? "call" : "calls"
  }`;
}

function formatCurrencyMicros(valueMicros: number, currency: string): string {
  return formatCurrencyAmount(valueMicros / 1_000_000, currency);
}

function formatCurrencyAmount(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      minimumFractionDigits: value < 1 ? 4 : 2,
      maximumFractionDigits: 4
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(value < 1 ? 4 : 2)}`;
  }
}
