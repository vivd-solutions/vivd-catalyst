# Use A Separate Node API Service For The Chat Backend

The chat backend will be a separate Node API service rather than being implemented as a Next.js/full-stack backend. This keeps the deployable client instance backend independent from frontend routing choices and gives cleaner boundaries for auth, Postgres, audit logging, agent runtime execution, tool execution, workers, and future self-hosted deployments.

