import type {
  AgentRunId,
  AuditEventId,
  ClientInstanceId,
  ConversationId,
  MessageId,
  ToolCallId
} from "./ids";
import type { JsonObject, JsonValue } from "./json";
import type { ISODateString } from "./time";

export type UserRole = "user" | "admin" | "superadmin" | string;

export interface AuthenticatedUser {
  id: string;
  externalUserId: string;
  displayLabel: string;
  email?: string;
  roles: UserRole[];
  permissionRefs: string[];
  clientInstanceId: ClientInstanceId;
  authSource: string;
  correlationId?: string;
}

export interface RuntimeCallContext {
  user: AuthenticatedUser;
  clientInstanceId: ClientInstanceId;
  correlationId: string;
  deadline?: Date;
  signal?: AbortSignal;
}

export interface ManagedFileRef {
  fileId: string;
  mimeType?: string;
  filename?: string;
  checksum?: string;
}

export interface ManagedArtifactRef {
  artifactId: string;
  kind: string;
  filename?: string;
  mimeType?: string;
}

export type DomainUiOutput = JsonObject & {
  kind: string;
  version: number;
  data: JsonObject;
};

export interface AuditSafeSummary {
  action: string;
  subject?: string;
  metadata?: JsonObject;
}

export type ConversationStatus = "active" | "deleted" | "retention_expired";

export interface Conversation {
  id: ConversationId;
  clientInstanceId: ClientInstanceId;
  ownerUserId: string;
  ownerExternalUserId: string;
  title: string;
  status: ConversationStatus;
  createdAt: ISODateString;
  updatedAt: ISODateString;
  retainedUntil: ISODateString;
  deletedAt?: ISODateString;
}

export type ChatMessageRole = "user" | "assistant" | "system" | "tool";

export interface ChatMessage {
  id: MessageId;
  conversationId: ConversationId;
  clientInstanceId: ClientInstanceId;
  role: ChatMessageRole;
  text: string;
  createdAt: ISODateString;
  metadata?: JsonObject;
}

export interface CreateConversationInput {
  clientInstanceId: ClientInstanceId;
  ownerUserId: string;
  ownerExternalUserId: string;
  title: string;
  retainedUntil: ISODateString;
}

export interface CreateMessageInput {
  clientInstanceId: ClientInstanceId;
  conversationId: ConversationId;
  role: ChatMessageRole;
  text: string;
  metadata?: JsonObject;
}

export interface ConversationStore {
  createConversation(input: CreateConversationInput): Promise<Conversation>;
  getConversation(
    clientInstanceId: ClientInstanceId,
    conversationId: ConversationId
  ): Promise<Conversation | undefined>;
  listConversationsForUser(input: {
    clientInstanceId: ClientInstanceId;
    ownerExternalUserId: string;
  }): Promise<Conversation[]>;
  appendMessage(input: CreateMessageInput): Promise<ChatMessage>;
  listMessages(input: {
    clientInstanceId: ClientInstanceId;
    conversationId: ConversationId;
  }): Promise<ChatMessage[]>;
  deleteConversation(input: {
    clientInstanceId: ClientInstanceId;
    conversationId: ConversationId;
    deletedAt: ISODateString;
  }): Promise<Conversation>;
}

export interface StartAgentRunInput {
  agentName: string;
  conversationId: ConversationId;
  message: {
    text: string;
    files?: ManagedFileRef[];
  };
}

export interface AgentRunHandle {
  runId: AgentRunId;
  status: AgentRunStatus;
  startedAt: ISODateString;
}

export type AgentRunStatus =
  | "running"
  | "waiting_for_permission"
  | "completed"
  | "cancelled"
  | "failed";

export type AgentRuntimeCommand =
  | {
      type: "tool_permission_decision";
      toolCallId: ToolCallId;
      approved: boolean;
      reason?: string;
    }
  | {
      type: "continue";
    };

export type AgentRuntimeEvent =
  | {
      type: "message_delta";
      runId: AgentRunId;
      sequence: number;
      createdAt: ISODateString;
      delta: string;
    }
  | {
      type: "message_completed";
      runId: AgentRunId;
      sequence: number;
      createdAt: ISODateString;
      message: {
        role: "assistant";
        text: string;
        domainUi?: DomainUiOutput;
      };
    }
  | {
      type: "tool_call_started";
      runId: AgentRunId;
      sequence: number;
      createdAt: ISODateString;
      toolCallId: ToolCallId;
      toolName: string;
    }
  | {
      type: "tool_permission_requested";
      runId: AgentRunId;
      sequence: number;
      createdAt: ISODateString;
      toolCallId: ToolCallId;
      toolName: string;
      reason: string;
      preview?: JsonObject;
    }
  | {
      type: "tool_call_completed";
      runId: AgentRunId;
      sequence: number;
      createdAt: ISODateString;
      toolCallId: ToolCallId;
      toolName: string;
      result: ToolExecutionResult;
    }
  | {
      type: "tool_call_failed";
      runId: AgentRunId;
      sequence: number;
      createdAt: ISODateString;
      toolCallId: ToolCallId;
      toolName: string;
      result: ToolExecutionResult;
    }
  | {
      type: "run_completed";
      runId: AgentRunId;
      sequence: number;
      createdAt: ISODateString;
    }
  | {
      type: "run_cancelled";
      runId: AgentRunId;
      sequence: number;
      createdAt: ISODateString;
      reason?: string;
    }
  | {
      type: "run_failed";
      runId: AgentRunId;
      sequence: number;
      createdAt: ISODateString;
      error: {
        code: string;
        message: string;
      };
    };

export interface AgentRuntime {
  start(
    input: StartAgentRunInput,
    context: RuntimeCallContext
  ): Promise<AgentRunHandle>;
  observe(
    runId: AgentRunId,
    context: RuntimeCallContext
  ): AsyncIterable<AgentRuntimeEvent>;
  resume(
    runId: AgentRunId,
    command: AgentRuntimeCommand,
    context: RuntimeCallContext
  ): Promise<void>;
  cancel(
    runId: AgentRunId,
    reason: string | undefined,
    context: RuntimeCallContext
  ): Promise<void>;
}

export type ToolPermissionMode = "allow" | "deny" | "approval_required";

export interface ToolPermissionPolicy {
  mode: ToolPermissionMode;
  reason?: string;
  requiredPermissionRefs?: string[];
}

export interface ToolDescriptor {
  name: string;
  description: string;
  inputJsonSchema?: JsonObject;
  permission?: ToolPermissionPolicy;
}

export interface ToolExecutionRequest {
  toolName: string;
  toolCallId: ToolCallId;
  agentRunId: AgentRunId;
  conversationId: ConversationId;
  agentName: string;
  input: unknown;
}

export interface ToolPermissionDecision {
  approved: boolean;
  decidedBy: string;
  decidedAt: ISODateString;
  reason?: string;
}

export type ToolAuthorizationDecision =
  | {
      status: "allowed";
      reason?: string;
    }
  | {
      status: "denied";
      reason: string;
    }
  | {
      status: "requires_approval";
      reason: string;
      preview?: JsonObject;
    };

export interface ApprovedToolExecutionRequest extends ToolExecutionRequest {
  authorization: Extract<ToolAuthorizationDecision, { status: "allowed" }>;
}

export interface ScopedSecretResolver {
  getSecret(name: string): Promise<string | undefined>;
}

export interface ToolExecutionContext extends RuntimeCallContext {
  permissionDecision?: ToolPermissionDecision;
  secrets?: ScopedSecretResolver;
}

export type ToolRuntimeContext = ToolExecutionContext;

export type ToolExecutionErrorCode =
  | "tool_not_found"
  | "not_allowed"
  | "approval_required"
  | "validation_failed"
  | "handler_failed"
  | "cancelled"
  | "timed_out";

export interface ToolExecutionError {
  code: ToolExecutionErrorCode;
  message: string;
  details?: JsonValue;
}

export interface ToolHandlerSuccessResult<TOutput = unknown> {
  status: "success";
  output: TOutput;
  modelSummary?: string;
  domainUi?: DomainUiOutput;
  artifacts?: ManagedArtifactRef[];
  auditSummary?: AuditSafeSummary;
}

export interface ToolHandlerFailureResult {
  status: "failed" | "cancelled" | "timed_out";
  error: ToolExecutionError;
  auditSummary?: AuditSafeSummary;
}

export type ToolHandlerResult<TOutput = unknown> =
  | ToolHandlerSuccessResult<TOutput>
  | ToolHandlerFailureResult;

export type ToolExecutionResult = ToolHandlerResult<unknown>;

export interface ToolExecution {
  authorize(
    request: ToolExecutionRequest,
    context: ToolExecutionContext
  ): Promise<ToolAuthorizationDecision>;
  execute(
    request: ApprovedToolExecutionRequest,
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult>;
}

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
