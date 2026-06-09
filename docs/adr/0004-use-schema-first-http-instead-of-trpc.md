# Use Schema-First HTTP Instead Of tRPC As The Core API Model

The core chat backend API will use a schema-first HTTP model with TypeScript-native validation rather than making tRPC the primary contract. This keeps the same mental model for the embeddable widget, self-hosted client instances, customer auth endpoints, OpenAPI integrations, MCP-adjacent tooling, and non-TypeScript consumers while still allowing strong TypeScript types through shared schemas and generated clients.

