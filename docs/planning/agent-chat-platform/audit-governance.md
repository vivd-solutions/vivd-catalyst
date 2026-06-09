# Audit And Governance

Governance is the small set of product controls needed to operate a sensitive client instance responsibly. In v1, that means permissions for sensitive actions, retention/deletion workflows, and a minimized audit event trail.

Audit is a product layer, not just application logging. It records security- and governance-relevant events so the client instance can explain what happened without retaining more sensitive content than necessary.

## What Governance Means Here

Governance does not mean a broad compliance suite in v1. It means the product has explicit behavior for:

- who can access normal chat, control-plane routes, and sensitive admin actions
- which data a normal user can see, delete, or request for deletion
- which metadata an admin/superadmin can inspect
- which actions require a stronger role, explicit reason, and audit event
- how retention policies delete conversations, messages, files, tool outputs, and derived document outputs
- how the instance can prove that a deletion, config change, or sensitive admin action happened

The v1 control plane should stay narrow: config visibility, retention status, audit event views, and deletion workflows. It should not become a full legal case-management system, SIEM, DSR portal, or enterprise admin suite.

## Why Audit Exists

Audit supports:

- accountability and compliance evidence
- security investigation
- data deletion and retention proof
- admin/superadmin governance actions
- tool execution traceability
- operational debugging without exposing full conversation content by default

GDPR does not say "this product must have an audit table" in those words. But GDPR Article 5 includes accountability, storage limitation, data minimization, and integrity/confidentiality principles; Article 30 requires records of processing activities in relevant cases; and Article 32 requires appropriate technical and organisational security measures for the risk. For sensitive AI workflows, an audit layer is a practical technical and organisational measure.

Sources:

- https://gdpr-info.eu/art-5-gdpr/
- https://gdpr-info.eu/art-30-gdpr/
- https://gdpr-text.com/read/article-32/

This is not legal advice. The customer/legal owner still needs to decide lawful basis, exact retention duration, data-subject request handling, and contractual processor obligations.

## What To Audit In V1

V1 should audit:

- auth events: successful/failed token exchange, dev auth use, role resolution
- conversation events: created, renamed, deleted, retention-expired
- message events: message created and model response completed, without storing full text in the audit event
- tool events: tool requested, allowed/denied, started, completed, failed, timeout/cancelled
- document events: uploaded/acquired, converted, extracted, deleted
- governance events: admin/superadmin read/export/delete actions
- config events: config version activated, validation failed, retention policy changed
- deployment events where available: release deployed, migration run, health check result

## What To Build In V1

The implementation target should be small and concrete:

- product-owned `AuditEvent` schema and `AuditRecorder` interface
- Postgres-backed audit event storage
- audit writes at auth, conversation, tool, document, config, deletion, and admin-action boundaries
- correlation ids that connect API requests, model calls, tool calls, and audit events
- control-plane screens for audit event search/filtering, retention status, and deletion actions
- permission checks for admin/superadmin routes
- reason-required flow for sensitive admin/superadmin actions
- integration tests that prove sensitive actions create audit events

Do not build these in v1 unless a customer requirement forces them:

- immutable ledger or tamper-evident log storage
- external SIEM export
- legal request/case workflow
- full data processing register editor
- broad admin dashboard unrelated to chat operations
- default full-message inspection for admins

## What Not To Audit By Default

Audit events should avoid full sensitive payloads:

- no full payslip text
- no full prompt or completion text
- no raw file bytes
- no long-lived tokens or secrets
- no unnecessary personal data

Instead, audit records should use references and metadata:

- conversation id
- message id
- tool call id
- file id
- actor id
- role/permission used
- event type
- status/result
- timestamps
- request/correlation id
- reason code where applicable

## Audit Retention

Audit retention should be configured separately from conversation retention. Some minimal audit metadata may need to live longer than conversation content to prove deletion, investigate incidents, or satisfy contractual requirements.

Audit retention still falls under data minimization. Do not keep sensitive content in audit logs to avoid deleting it elsewhere.

## Admin Access

V1 should default admin/superadmin views to metadata, deletion, and export/request-handling tools. Full conversation message access should require an explicit client-instance config flag, a permission check, and a recorded audit event with reason.

Recommended v1 default: admins can inspect metadata and operational state; superadmins can perform deletion/export/governance actions; neither role gets invisible full-message browsing by default.
