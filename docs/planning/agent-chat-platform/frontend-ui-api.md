# Frontend, UI, And API Client

The stack should provide both an embeddable chat UI and a standalone surface. The chat experience itself should be the same chat in both places.

## UI Stack

- assistant-ui is the default candidate for shared chat UI primitives/runtime.
- Use assistant-ui only if it remains fully customizable.
- Do not use Assistant Cloud for auth, persistence, or conversation storage.
- Keep auth, persistence, audit, and conversation storage in our own backend/Postgres.

Recommended packages:

```text
chat-ui          shared chat components and state
chat-widget      embedded shell
chat-standalone  full-page/local chat shell
control-plane    settings/governance/admin shell, may live inside chat-standalone initially
```

The shared `chat-ui` package may wrap assistant-ui components/runtime internally, but the product should expose its own UI composition boundary so embedded and standalone chat surfaces are not coupled directly to assistant-ui decisions.

## Standalone Surface And Control Plane

The standalone surface serves two purposes:

1. **Direct chat access**
   - Same chat experience as the embedded widget.
   - Useful for local testing, demos, and direct access through a domain.

2. **Control plane**
   - Basic configuration and governance screens.
   - Can start as routes inside `chat-standalone`.
   - May become a separate package/shell later if it grows.

V1 control-plane candidates:

- view active client-instance release config and config snapshots
- view own conversations
- delete own conversations where allowed
- admin/superadmin view for governance tasks
- inspect/delete conversations and related data where legally/contractually permitted
- view audit and retention-job status

Admin/superadmin access must be explicit, permissioned, and audited. Sensitive-data workflows should not allow broad invisible access to user conversations without a governance reason.

By default, admin/superadmin views should show metadata, deletion workflows, export/request-handling tools, and audit status. Full conversation message access should require an explicit config flag, a permission check, and an audit reason.

## Domain UI Outputs

V1 should support typed UI extension points for domain-specific outputs. The first likely example is document processing:

```text
document analysis panel
  -> list uploaded/acquired documents
  -> show extracted fields per document
  -> show confidence/warnings
  -> show comparison against application/email statements
  -> link back to source document
```

These extension points should be typed product surfaces, such as `DocumentAnalysisViewModel` or `ToolResultViewModel`, rather than arbitrary injected frontend code. This keeps the chat shell customizable for real workflows without committing to a broad plugin system in v1.

## Streaming Chat Path

Vercel AI SDK is the default v1 internal candidate for model calls, streaming, provider adapters, and tool-call plumbing. It should stay behind product-owned `Agent Runtime`, `Tool Execution`, API, and message contracts.

```text
assistant-ui
  -> @assistant-ui/react-ai-sdk
  -> Vercel AI SDK transport/streaming
  -> our schema-first chat API
  -> our AgentRuntime
```

## Normal Frontend Server State

TanStack Query is the default for frontend server state outside the Vercel AI SDK streaming chat path:

- conversation lists
- conversation metadata
- authenticated user state
- config and feature flags
- file/upload metadata
- feedback mutations

TanStack Router is the default for the standalone chat UI and any future admin/config UI. The embedded widget should stay router-light unless the embedded experience grows beyond a compact chat surface.

## API Client

The frontend should use a generated or generated-assisted API client for normal HTTP operations. The source of truth should remain the backend's schema-first HTTP contract.

```text
backend Zod/product schemas
  -> OpenAPI contract
  -> generated API client package
  -> TanStack Query wrappers/query options
  -> chat-widget and chat-standalone
```

The generated API client should cover normal request/response operations such as conversations, config, authenticated user state, file metadata, feedback, and audit views. The live chat stream may use assistant-ui/Vercel AI SDK transport primitives instead of being treated as a normal TanStack Query request.

The conversation list must be user-scoped by the backend. The frontend should not filter another user's conversations out of a shared response.

API client generator:

**Hey API / `@hey-api/openapi-ts`** is the default v1 generator candidate. It can generate TypeScript SDKs, Zod schemas, and TanStack Query hooks from OpenAPI, which matches the preferred schema/client/query stack.

If Hey API fails during implementation, evaluate Orval or `openapi-typescript`/`openapi-fetch` as fallbacks.
