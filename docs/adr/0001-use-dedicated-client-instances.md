# Use Dedicated Client Instances Instead Of Managed Multi-Tenant SaaS

The product will not be designed as a shared managed multi-tenant SaaS. Each customer gets a separate client instance with separate infrastructure, which may be operated by us at first or self-hosted by the customer later. This keeps the architecture aligned with sensitive-data workflows, custom code tools, and future self-hosted deployments, even though it gives up some economies of scale from shared infrastructure.

