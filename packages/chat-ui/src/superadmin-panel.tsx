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
    <section className="acp-admin" aria-label="Superadmin panel">
      <header className="acp-admin-header">
        <div>
          <span>Superadmin</span>
          <strong>Usage and governance</strong>
        </div>
        <div className="acp-status">
          <span />
          {loading ? "Loading" : "Live"}
        </div>
      </header>

      <div className="acp-admin-content">
        {error ? (
          <div className="acp-notice">
            <AlertCircle size={17} aria-hidden="true" />
            <span>{error}</span>
          </div>
        ) : null}

        <div className="acp-admin-grid">
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

        <section className="acp-admin-section">
          <h2>Usage volume</h2>
          <dl className="acp-limit-list">
            <UsageStat icon={<Activity size={15} />} label="Calls today" value={usage?.today.modelCallCount ?? 0} />
            <UsageStat icon={<BarChart3 size={15} />} label="Tokens today" value={usage?.today.totalTokens ?? 0} />
            <UsageStat icon={<Database size={15} />} label="Tokens this month" value={usage?.currentMonth.totalTokens ?? 0} />
          </dl>
        </section>

        <section className="acp-admin-section">
          <h2>Configured pricing</h2>
          {usage?.pricing.models.length ? (
            <dl className="acp-limit-list">
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
            <p>No model pricing configured.</p>
          )}
        </section>

        <section className="acp-admin-section">
          <h2>Configured limits</h2>
          <dl className="acp-limit-list">
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
        </section>

        <section className="acp-admin-section">
          <h2>Recent model usage</h2>
          <div className="acp-table">
            {(usage?.recentEvents ?? []).map((event) => (
              <div key={event.id} className="acp-table-row acp-table-row--usage">
                <span>{new Date(event.createdAt).toLocaleString()}</span>
                <strong>{event.model}</strong>
                <strong>{formatCost(event.cost)}</strong>
                <span>{event.totalTokens.toLocaleString()} tokens</span>
                <span>{event.source}</span>
              </div>
            ))}
            {usage?.recentEvents.length === 0 ? <p>No model usage recorded yet.</p> : null}
          </div>
        </section>

        <section className="acp-admin-section">
          <h2>Recent audit events</h2>
          <div className="acp-table">
            {auditEvents.slice(0, 8).map((event) => (
              <div key={event.id} className="acp-table-row">
                <span>{new Date(event.createdAt).toLocaleString()}</span>
                <strong>{event.type}</strong>
                <span>{event.status}</span>
                <span>{event.subject ?? ""}</span>
              </div>
            ))}
            {auditEvents.length === 0 ? <p>No audit events visible yet.</p> : null}
          </div>
        </section>
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
    <article className={primary ? "acp-metric acp-metric--primary" : "acp-metric"}>
      <div>{icon}</div>
      <span>{label}</span>
      <strong>{value}</strong>
      {detail ? <small>{detail}</small> : null}
    </article>
  );
}

function UsageStat({ icon, label, value }: { icon: ReactNode; label: string; value: number | undefined }) {
  return (
    <div>
      <dt>
        {icon}
        {label}
      </dt>
      <dd>{value === undefined ? "Not configured" : value.toLocaleString()}</dd>
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
    <div>
      <dt>
        <DollarSign size={15} aria-hidden="true" />
        {label}
      </dt>
      <dd>
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
