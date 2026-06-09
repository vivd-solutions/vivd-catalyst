import {
  type AuditActor,
  type AuditEvent,
  type AuditEventInput,
  type AuditEventStore,
  type AuthenticatedUser,
  type ClientInstanceId
} from "@agent-chat-platform/chat-core";

export interface AuditRecorder {
  record(input: Omit<AuditEventInput, "clientInstanceId">): Promise<AuditEvent>;
}

export class StoreBackedAuditRecorder implements AuditRecorder {
  private readonly clientInstanceId: ClientInstanceId;
  private readonly store: AuditEventStore;

  constructor(input: { clientInstanceId: ClientInstanceId; store: AuditEventStore }) {
    this.clientInstanceId = input.clientInstanceId;
    this.store = input.store;
  }

  record(input: Omit<AuditEventInput, "clientInstanceId">): Promise<AuditEvent> {
    return this.store.appendAuditEvent({
      ...input,
      clientInstanceId: this.clientInstanceId
    });
  }
}

export class NoopAuditRecorder implements AuditRecorder {
  async record(input: Omit<AuditEventInput, "clientInstanceId">): Promise<AuditEvent> {
    return {
      id: "audit_noop" as AuditEvent["id"],
      clientInstanceId: "noop" as ClientInstanceId,
      type: input.type,
      status: input.status,
      actor: input.actor,
      subject: input.subject,
      reason: input.reason,
      correlationId: input.correlationId,
      createdAt: new Date().toISOString(),
      metadata: input.metadata
    };
  }
}

export function auditActorFromUser(user: AuthenticatedUser): AuditActor {
  return {
    userId: user.id,
    externalUserId: user.externalUserId,
    displayLabel: user.displayLabel,
    roles: user.roles
  };
}

