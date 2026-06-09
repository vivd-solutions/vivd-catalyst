import type { AuditEventId, ClientInstanceId } from "./ids";
import type { JsonObject } from "./json";
import type { ISODateString } from "./time";
import type { UserRole } from "./identity";

export interface AuditActor {
  userId: string;
  externalUserId: string;
  displayLabel: string;
  roles: UserRole[];
}

export type AuditEventStatus = "success" | "failed" | "denied";

export interface AuditEvent {
  id: AuditEventId;
  clientInstanceId: ClientInstanceId;
  type: string;
  status: AuditEventStatus;
  actor?: AuditActor;
  subject?: string;
  reason?: string;
  correlationId: string;
  createdAt: ISODateString;
  metadata?: JsonObject;
}

export interface AuditEventInput {
  clientInstanceId: ClientInstanceId;
  type: string;
  status: AuditEventStatus;
  actor?: AuditActor;
  subject?: string;
  reason?: string;
  correlationId: string;
  metadata?: JsonObject;
}

export interface AuditEventStore {
  appendAuditEvent(input: AuditEventInput): Promise<AuditEvent>;
  listAuditEvents(input: {
    clientInstanceId: ClientInstanceId;
    limit?: number;
    type?: string;
  }): Promise<AuditEvent[]>;
}
