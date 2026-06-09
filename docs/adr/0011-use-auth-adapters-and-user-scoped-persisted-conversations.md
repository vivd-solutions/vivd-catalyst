# Use Auth Adapters And User-Scoped Persisted Conversations

The chat backend will resolve users through an auth adapter and persist conversations server-side, scoped to the authenticated user. The first production adapter is customer-backed token auth, while development auth supplies a local mock user. Conversation access must be enforced by the backend and retained only for the configured retention window, because sensitive workflows cannot rely on browser-local history or frontend-side filtering.

