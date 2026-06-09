# Use Product-Owned Types At Public Boundaries

Public package, SDK, API, config, persistence, and inter-package contracts should use product-owned stable types rather than exporting third-party framework types directly. External types from assistant-ui, Vercel AI SDK, Mastra, LangChain, or other libraries may be used inside implementations and adapters. This keeps upstream library changes from leaking into client code and preserves the option to swap internal runtimes later.

