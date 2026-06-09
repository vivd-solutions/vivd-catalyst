import {
  CompositeAuthAdapter,
  DevelopmentAuthAdapter,
  HmacSessionTokenAuthAdapter,
  HmacSessionTokenIssuer,
  createStandaloneAuthRuntime,
  type AuthAdapter
} from "@agent-chat-platform/auth";
import { AppError, type ClientInstanceId } from "@agent-chat-platform/chat-core";
import { getDevelopmentAuthUsers, type ClientInstanceConfig } from "@agent-chat-platform/config-schema";
import type { ClientInstanceEnv } from "./env";

export interface ClientInstanceAuth {
  authAdapter: AuthAdapter;
  standaloneAuth?: Awaited<ReturnType<typeof createStandaloneAuthRuntime>>;
  sessionToken?: {
    issuer: HmacSessionTokenIssuer;
    serverCredential: string;
  };
}

export async function createClientInstanceAuth(input: {
  config: ClientInstanceConfig;
  env: ClientInstanceEnv;
  clientInstanceId: ClientInstanceId;
  corsOrigin?: string | string[];
}): Promise<ClientInstanceAuth> {
  const adapters: AuthAdapter[] = [];
  let standaloneAuth: ClientInstanceAuth["standaloneAuth"];

  if (input.config.auth.standalone?.enabled) {
    const databaseUrl = input.env.DATABASE_URL;
    const secret = input.env.BETTER_AUTH_SECRET;
    if (!databaseUrl) {
      throw new AppError(
        "VALIDATION_FAILED",
        "Standalone Better Auth requires DATABASE_URL; start Postgres or set DATABASE_URL"
      );
    }
    if (!secret || secret.length < 32) {
      throw new AppError(
        "VALIDATION_FAILED",
        "Standalone Better Auth requires BETTER_AUTH_SECRET with at least 32 characters"
      );
    }

    standaloneAuth = await createStandaloneAuthRuntime({
      clientInstanceId: input.clientInstanceId,
      databaseUrl,
      secret,
      baseUrl: resolveBetterAuthUrl(input),
      trustedOrigins: resolveTrustedOrigins(input),
      seedUsers: input.config.auth.standalone.seedUsers.map((seedUser) => ({
        email: seedUser.email,
        displayLabel: seedUser.displayLabel,
        password: resolveSeedPassword(seedUser, input),
        roles: seedUser.roles,
        permissionRefs: seedUser.permissionRefs
      }))
    });
    adapters.push(standaloneAuth.authAdapter);
  }

  const development = getDevelopmentAuthUsers(input.config);
  if (development) {
    adapters.push(
      new DevelopmentAuthAdapter({
        enabled: true,
        users: development.users,
        defaultUserId: development.defaultUserId
      })
    );
  }

  const tokenSecret = input.env.CHAT_SESSION_TOKEN_SECRET;
  const serverCredential = input.env.CHAT_SERVER_CREDENTIAL;
  if (tokenSecret && serverCredential && input.config.auth.sessionToken) {
    const tokenOptions = {
      secret: tokenSecret,
      clientInstanceId: input.clientInstanceId,
      issuer: input.config.auth.sessionToken.issuer,
      ttlSeconds: input.config.auth.sessionToken.ttlSeconds
    };
    adapters.push(new HmacSessionTokenAuthAdapter(tokenOptions));
    return {
      authAdapter: new CompositeAuthAdapter(adapters),
      standaloneAuth,
      sessionToken: {
        issuer: new HmacSessionTokenIssuer(tokenOptions),
        serverCredential
      }
    };
  }

  if (adapters.length === 0) {
    throw new AppError("VALIDATION_FAILED", "No auth adapter is configured");
  }

  return {
    authAdapter: new CompositeAuthAdapter(adapters),
    standaloneAuth
  };
}

function resolveBetterAuthUrl(input: {
  config: ClientInstanceConfig;
  env: ClientInstanceEnv;
}): string {
  return (
    input.config.auth.standalone?.baseUrl ??
    input.env.BETTER_AUTH_URL ??
    `http://127.0.0.1:${input.env.PORT ?? "4100"}/api/auth`
  );
}

function resolveTrustedOrigins(input: {
  config: ClientInstanceConfig;
  env: ClientInstanceEnv;
  corsOrigin?: string | string[];
}): string[] {
  const fromCors = Array.isArray(input.corsOrigin)
    ? input.corsOrigin
    : input.corsOrigin
      ? [input.corsOrigin]
      : [];
  return [
    ...new Set([
      ...fromCors,
      ...(input.env.CHAT_UI_ORIGIN ? [input.env.CHAT_UI_ORIGIN] : []),
      ...(input.config.auth.standalone?.trustedOrigins ?? [])
    ])
  ];
}

function resolveSeedPassword(
  seedUser: NonNullable<ClientInstanceConfig["auth"]["standalone"]>["seedUsers"][number],
  input: {
    config: ClientInstanceConfig;
    env: ClientInstanceEnv;
  }
): string {
  const password = input.env[seedUser.passwordEnvName] ?? seedUser.developmentPassword;
  if (!password) {
    throw new AppError(
      "VALIDATION_FAILED",
      `Missing password environment variable '${seedUser.passwordEnvName}' for standalone auth seed user '${seedUser.email}'`
    );
  }
  return password;
}
