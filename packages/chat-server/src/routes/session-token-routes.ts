import type { FastifyInstance } from "fastify";
import { issueSessionTokenRequestSchema } from "@agent-chat-platform/api-contract";
import { AppError } from "@agent-chat-platform/core";
import type { ChatServerOptions } from "../types";
import { createCorrelationId, parseBody } from "../request-context";

export function registerSessionTokenRoutes(app: FastifyInstance, options: ChatServerOptions): void {
  app.post("/auth/session-token", async (request) => {
    if (!options.sessionToken) {
      throw new AppError("NOT_FOUND", "Session token issuing is not configured");
    }
    const credential = request.headers["x-server-credential"];
    if (credential !== options.sessionToken.serverCredential) {
      throw new AppError("FORBIDDEN", "Invalid server credential");
    }
    const body = parseBody(issueSessionTokenRequestSchema, request.body);
    const issued = options.sessionToken.issuer.issue(body);
    await options.auditRecorder.record({
      type: "auth.session_token_issued",
      status: "success",
      subject: body.externalUserId,
      correlationId: body.correlationId ?? createCorrelationId(request),
      metadata: {
        roles: body.roles ?? [],
        permissionRefs: body.permissionRefs ?? []
      }
    });
    return issued;
  });
}
