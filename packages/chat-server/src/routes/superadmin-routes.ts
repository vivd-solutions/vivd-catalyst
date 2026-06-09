import type { FastifyInstance } from "fastify";
import type { ChatServerOptions } from "../types";
import { authorizeGovernanceAction } from "../governance-actions";
import { authenticateRequest } from "../request-context";

export function registerSuperadminRoutes(app: FastifyInstance, options: ChatServerOptions): void {
  app.get("/api/superadmin/usage", async (request) => {
    const { user, context } = await authenticateRequest(options, request);
    await authorizeGovernanceAction({
      options,
      user,
      context,
      requiredRole: "superadmin",
      auditType: "governance.usage_viewed",
      deniedMessage: "Usage governance requires a superadmin role"
    });

    return options.usageGovernance.createSummary({
      clientInstanceId: options.clientInstanceId
    });
  });
}
