import type { AuditEventStore } from "./audit";
import type { ConversationStore } from "./conversation";
import type { ModelUsageEventStore } from "./usage";

export interface PlatformStore extends ConversationStore, AuditEventStore, ModelUsageEventStore {
  close?: () => Promise<void>;
}
