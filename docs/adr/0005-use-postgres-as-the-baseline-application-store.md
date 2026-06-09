# Use Postgres As The Baseline Application Store

The first client instances should use Postgres for normal application data such as conversations, messages, audit events, config snapshots, user identity mappings, tool call records, retention state, and retrieval reference metadata. Postgres fits a VPS-friendly deployment and keeps the option open to use pgvector for simple retrieval needs. Dedicated vector stores such as Milvus can still be added behind retrieval adapters when scale or search requirements justify the extra operational footprint.
