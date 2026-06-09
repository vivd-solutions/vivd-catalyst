# Agent Chat Platform

This repository is a greenfield foundation for reusable, code-deployed AI agent chat client instances.

The first implementation keeps product-owned contracts separate from adapters and client assembly code:

- `packages/` contains reusable platform packages.
- `clients/demo/` is a thin client instance that imports platform packages, defines release config, and registers custom tools.
- `docs/` keeps product planning and architecture decisions.

Run the local vertical slice:

```bash
pnpm install
cp .env.example .env
pnpm build
pnpm dev
```

Paste an OpenAI API key into `.env` before using the default demo config. The demo API listens on `http://127.0.0.1:4100` and the standalone chat UI listens on `http://127.0.0.1:5173`.

Useful checks:

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm check
pnpm test:e2e
```

`pnpm test:e2e` uses a deterministic fixture config so it does not require an OpenAI key.

The deterministic model provider is kept for local tests and repeatable debugging. The demo client config uses OpenAI by default and lets the model call registered tools automatically.
