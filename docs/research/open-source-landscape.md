# Open-Source Landscape

Date: 2026-06-04

This note tracks open-source and developer-first projects that are close to the planned agent chat platform. None of them appear to match the desired product shape exactly: TypeScript/Node, code-deployed client instances, reusable platform packages, custom code tools, embedded and standalone chat UI, OpenAPI/MCP tool sources, Postgres-backed auditability, and no managed multi-tenant SaaS assumptions.

## Likely Dependencies To Evaluate

**Vercel AI SDK**  
TypeScript toolkit for model calls, streaming, chat UI hooks, tool calling, providers, and MCP integration. It is a strong candidate for the default local agent runtime internals, but should stay behind this product's own `Agent Runtime` and `Tool Execution` interfaces.

Decision note: Vercel AI SDK is the default candidate for v1 internal model/tool streaming implementation. Its types and APIs should stay inside adapters/internal implementation packages rather than becoming public product contracts.

Sources:
- https://ai-sdk.dev/docs/introduction
- https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling
- https://ai-sdk.dev/docs/ai-sdk-ui/chatbot

**assistant-ui**  
React chat UI/runtime library with adapters for AI SDK, LangGraph, AG-UI, attachments, persistence, feedback, and thread lists. It is a strong candidate for the shared `chat-ui` package, especially if we want polished chat surfaces without building every message/tool-call UI primitive ourselves.

Decision note: assistant-ui is the default candidate for `chat-ui`, provided it remains fully customizable and we keep auth, persistence, audit, and thread storage in our own backend/Postgres instead of Assistant Cloud.

Sources:
- https://www.assistant-ui.com/docs
- https://www.assistant-ui.com/docs/runtimes/concepts/adapters
- https://www.assistant-ui.com/docs/runtimes/ai-sdk/overview

**Model Context Protocol TypeScript SDK**  
Official TypeScript SDK for MCP clients and servers. This should be evaluated for the MCP tool adapter instead of hand-rolling protocol support.

Sources:
- https://modelcontextprotocol.io/docs/sdk
- https://github.com/modelcontextprotocol/typescript-sdk

**Zod**  
Not researched here because it is already a working assumption, but it remains the likely schema library for custom tools, config validation, and API contracts.

**Hey API / `@hey-api/openapi-ts`**  
OpenAPI-to-TypeScript generator that can produce SDKs, Zod schemas, and TanStack Query hooks. This is a strong candidate for the generated `api-client` package because it aligns with schema-first HTTP, Zod, and TanStack Query. It should be evaluated against Orval and `openapi-typescript`/`openapi-fetch`; exact versions should be pinned while the package is moving quickly.

Sources:
- https://heyapi.dev/
- https://github.com/hey-api/openapi-ts

**Better Auth**  
TypeScript-native, framework-agnostic, self-hosted/open-source authentication framework with database adapters, TypeScript inference, CLI-supported schema/migration workflows, and plugins such as admin and organization access control. It is the default library decision for first-party standalone/control-plane production login and admin accounts.

Decision note: embedded customer-user auth should not use a full login framework in v1; it should use the product-owned auth adapter and short-lived chat session tokens. Better Auth should be used only as an implementation inside an auth adapter/control-plane auth module. Do not expose Better Auth user/session/plugin types as platform public types.

Sources:
- https://www.better-auth.com/
- https://better-auth.com/docs/concepts/database
- https://better-auth.com/docs/concepts/typescript
- https://better-auth.com/docs/plugins
- https://better-auth.com/docs/plugins/organization

## Strong References, Not Immediate Dependencies

**Mastra**  
TypeScript-native agent framework with tools, workflows, MCP, memory, RAG, vector stores, and deployment concepts. It is the closest architectural match for TypeScript agent internals. It should be evaluated carefully before adopting because the product should not expose Mastra types as its public contract.

Sources:
- https://mastra.ai/docs/agents/using-tools
- https://mastra.ai/docs/rag/overview
- https://mastra.ai/docs/deployment/overview

**AG-UI / CopilotKit**  
AG-UI is an open event protocol for agent-to-user interaction. CopilotKit is a frontend/runtime stack built around in-app agents, generative UI, MCP, and AG-UI-compatible backends. These are useful references for the streaming event contract between agent runtime and UI, especially for future isolated agent workers and deeper UI plugins.

Sources:
- https://docs.ag-ui.com/introduction
- https://docs.ag-ui.com/concepts/events
- https://docs.copilotkit.ai/
- https://docs.copilotkit.ai/langgraph/copilot-runtime

**LangChain.js / LangGraph**  
Broad agent/workflow framework with tools, vector stores, and deployment concepts. Useful as a reference for graph/stateful agent execution and adapters, but should not become the product's public contract. LangGraph Platform self-hosting has licensing/platform considerations separate from the open-source libraries.

Sources:
- https://docs.langchain.com/oss/javascript/langchain/tools
- https://docs.langchain.com/oss/javascript/langgraph/workflows-agents
- https://docs.langchain.com/langgraph-platform/self-hosted

**LlamaIndex.TS**  
Useful reference for retrieval/document ingestion and knowledge-source design. It is more relevant once vector retrieval becomes concrete.

Source:
- https://ts.llamaindex.ai/

## Complete Products To Study

These are useful benchmarks, but their shape is generally not the desired product shape. Most are full platforms or visual builders rather than code-deployed reusable packages.

**Dify**  
Self-hostable LLM app/workflow platform with Docker Compose, workflows, knowledge bases, custom tools, plugin daemon, sandbox, OpenAPI custom tools, and MCP. Strong benchmark for complete platform scope and operational footprint.

Sources:
- https://docs.dify.ai/en/self-host/quick-start/docker-compose
- https://docs.dify.ai/en/use-dify/workspace/tools
- https://docs.dify.ai/en/use-dify/knowledge/readme

**Flowise**  
Open-source visual builder for agents/workflows with Node/React monorepo, embedded chat widget, custom JavaScript tools, MCP, RAG, vector stores, and API/SDK/CLI. Useful cautionary reference for visual/runtime mutation versus code-deployed architecture.

Sources:
- https://docs.flowiseai.com/getting-started
- https://docs.flowiseai.com/using-flowise/embed
- https://docs.flowiseai.com/tutorials/tools-and-mcp

**LibreChat**  
Self-hosted ChatGPT-like interface with Docker quick start, YAML config, agents, MCP, RAG, access control, and per-user MCP credentials. Strong reference for MCP management, per-user credentials, and chat product features.

Sources:
- https://www.librechat.ai/docs
- https://www.librechat.ai/docs/features/mcp
- https://www.librechat.ai/docs/features/agents

**Open WebUI**  
Self-hosted AI web UI with tools/functions, pipelines, RAG, MCP, OpenAPI tool servers, and plugin ecosystem. Useful reference for extensibility patterns and the operational complexity of broad plugin support.

Sources:
- https://docs.openwebui.com/features
- https://docs.openwebui.com/features/extensibility/plugin/tools/
- https://docs.openwebui.com/features/pipelines/pipes/

**AnythingLLM**  
Self-hosted/private AI app with RAG, agents, custom skills, MCP, and embeddable chat widgets. Useful reference for self-hosted privacy UX and custom skill/plugin warnings.

Sources:
- https://docs.anythingllm.com/
- https://docs.anythingllm.com/features/chat-widgets
- https://docs.anythingllm.com/mcp-compatibility/overview

**Onyx**  
Self-hosted enterprise search/chat platform with agents, actions, MCP, connectors, permissions, citations, and document indexing. Useful reference for knowledge-source permissions and enterprise RAG concepts.

Source:
- https://docs.onyx.app/developers/core_concepts

## Azure Reference

**Microsoft Foundry Agent Service**  
Not open source, but important because Azure/OpenAI compliance may matter for the first customer. Foundry supports OpenAPI tools, MCP tools, and knowledge retrieval via Azure AI Search/Foundry IQ. It is useful as a reference for enterprise tool/knowledge integration patterns, not as a product foundation.

Sources:
- https://learn.microsoft.com/en-us/azure/foundry/agents/how-to/tools/openapi
- https://learn.microsoft.com/en-us/azure/ai-foundry/agents/how-to/tools/knowledge-retrieval
- https://learn.microsoft.com/en-us/azure/ai-services/agents/how-to/tools/overview

## Recommendation

Add these as first evaluation candidates:

1. **Vercel AI SDK** for internal model/tool streaming primitives.
2. **assistant-ui** for shared chat UI primitives.
3. **Model Context Protocol TypeScript SDK** for MCP adapter support.
4. **Mastra** as a serious candidate for default agent runtime internals, but only if it can stay behind our interfaces.

Study these, but do not adopt as the product foundation:

- Dify
- Flowise
- LibreChat
- Open WebUI
- AnythingLLM
- Onyx

The architectural lesson is consistent: the mature projects either become broad visual platforms or full ChatGPT-style web apps. Our differentiator should stay narrower: code-deployed client instances, reusable TypeScript packages, auditable custom code tools, and explicit runtime/storage/security boundaries.
