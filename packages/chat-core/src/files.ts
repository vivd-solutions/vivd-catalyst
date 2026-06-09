import type { JsonObject } from "./json";

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
