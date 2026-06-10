# 0012 Realign V1 API, Runtime, And Package Boundaries

Date: 2026-06-10

## Status

Accepted

## Context

The v1 implementation had drifted from the planning decisions in a few places:

- the shipped chat UI used `POST /api/chat`, while `api-contract` described a blocking conversation-message send path
- the stream response was treated as an AI SDK implementation detail instead of a product-owned wire contract
- the local agent runtime ignored prior persisted turns
- runtime and usage modules imported YAML config types from `config-schema`
- package names and package seams made `core`, audit, memory store, and client assembly responsibilities less clear

## Decision

`api-contract` owns the chat stream request and stream chunk schemas. The wire format remains compatible with the Vercel AI SDK UI message stream protocol, but compatibility is an adapter constraint, not the source of truth.

The blocking `POST /api/conversations/:id/messages` send path is removed until a concrete consumer needs a deliberate non-streaming API.

Conversation history is owned by the agent runtime. The HTTP layer sends the new user message only; the runtime reads prior turns through `ConversationHistoryReader`.

`chat-core` is renamed to `core`, and `client-instance` is renamed to `client-assembly`. Audit recording lives in `core`, and the in-memory store is a `core/testing` subpath.

Usage governance serializes reservation accounting, not model execution. In-flight reservations count toward daily call limits. Actual usage is recorded when the provider call completes, and failed calls release their reservation. Bounded overshoot on token limits from concurrent in-flight calls is accepted for v1.

`config-schema` is a leaf that parses YAML into product-owned types from `core`; runtime, model provider, and usage governance packages do not depend on it.

## Consequences

An AI SDK upgrade that changes the stream wire format is a product contract change.

The UI, unit tests, and e2e tests exercise the same streaming send path.

Runtime history policy can evolve behind a narrow seam without expanding the HTTP contract.

Customer dependency lists contain platform packages and concrete storage packages, not test fakes or pass-through audit packages.
