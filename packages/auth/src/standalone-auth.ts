import { randomUUID } from "node:crypto";
import { betterAuth } from "better-auth";
import { hashPassword } from "better-auth/crypto";
import { fromNodeHeaders } from "better-auth/node";
import { PostgresDialect } from "kysely";
import { Pool, type PoolConfig } from "pg";
import {
  AppError,
  type AuthenticatedUser,
  type ClientInstanceId
} from "@agent-chat-platform/chat-core";
import type { AuthAdapter, AuthRequest } from "./types";

export interface StandaloneAuthSeedUser {
  email: string;
  displayLabel: string;
  password: string;
  roles: string[];
  permissionRefs: string[];
}

export interface StandaloneAuthOptions {
  clientInstanceId: ClientInstanceId;
  databaseUrl: string;
  secret: string;
  baseUrl: string;
  trustedOrigins?: string[];
  seedUsers?: StandaloneAuthSeedUser[];
}

export interface StandaloneAuthRuntime {
  handleRequest(request: Request): Promise<Response>;
  authAdapter: AuthAdapter;
  baseUrl: string;
  seedUsers(): Promise<void>;
  close(): Promise<void>;
}

interface AuthUserRow {
  id: string;
  email: string;
  name: string;
}

interface StandaloneProfileRow {
  auth_user_id: string;
  external_user_id: string;
  display_label: string;
  roles: string[];
  permission_refs: string[];
}

interface BetterAuthSessionApi {
  api: {
    getSession(input: { headers: Headers }): Promise<
      | {
          user: {
            id: string;
            email: string;
          };
        }
      | null
    >;
  };
}

export async function createStandaloneAuthRuntime(
  options: StandaloneAuthOptions
): Promise<StandaloneAuthRuntime> {
  const pool = new Pool({
    connectionString: options.databaseUrl,
    max: 10
  } satisfies PoolConfig);
  const profileStore = new StandaloneAuthProfileStore(pool, options.clientInstanceId);
  const auth = betterAuth({
    database: new PostgresDialect({ pool }),
    secret: options.secret,
    baseURL: options.baseUrl,
    trustedOrigins: options.trustedOrigins ?? [],
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8
    }
  });

  async function seedUsers(): Promise<void> {
    for (const seedUser of options.seedUsers ?? []) {
      await profileStore.seedUser(seedUser);
    }
  }

  await seedUsers();

  return {
    handleRequest: (request) => auth.handler(request),
    authAdapter: new BetterAuthAdapter(auth, profileStore),
    baseUrl: options.baseUrl,
    seedUsers,
    async close() {
      await pool.end();
    }
  };
}

class BetterAuthAdapter implements AuthAdapter {
  readonly id = "better-auth";

  constructor(
    private readonly auth: BetterAuthSessionApi,
    private readonly profiles: StandaloneAuthProfileStore
  ) {}

  async authenticate(request: AuthRequest): Promise<AuthenticatedUser> {
    const session = await this.auth.api.getSession({
      headers: fromNodeHeaders(request.headers)
    });
    if (!session) {
      throw new AppError("UNAUTHENTICATED", "Sign in is required");
    }

    const profile = await this.profiles.getProfile(session.user.id);
    if (!profile) {
      throw new AppError("FORBIDDEN", "Signed-in user is not authorized for this client instance");
    }

    return {
      id: profile.auth_user_id,
      externalUserId: profile.external_user_id,
      displayLabel: profile.display_label,
      email: session.user.email,
      roles: profile.roles,
      permissionRefs: profile.permission_refs,
      clientInstanceId: request.clientInstanceId,
      authSource: this.id,
      correlationId: request.correlationId
    };
  }
}

class StandaloneAuthProfileStore {
  constructor(
    private readonly pool: Pool,
    private readonly clientInstanceId: ClientInstanceId
  ) {}

  async getProfile(authUserId: string): Promise<StandaloneProfileRow | undefined> {
    const { rows } = await this.pool.query<StandaloneProfileRow>(
      `
        select
          auth_user_id,
          external_user_id,
          display_label,
          roles,
          permission_refs
        from standalone_auth_profiles
        where client_instance_id = $1
          and auth_user_id = $2
        limit 1
      `,
      [this.clientInstanceId, authUserId]
    );
    return rows[0];
  }

  async seedUser(seedUser: StandaloneAuthSeedUser): Promise<void> {
    const email = seedUser.email.toLowerCase();
    const authUser = await this.upsertAuthUser(email, seedUser.displayLabel);
    await this.upsertCredentialAccount(authUser.id, seedUser.password);
    await this.upsertProfile({
      authUserId: authUser.id,
      externalUserId: authUser.id,
      displayLabel: seedUser.displayLabel,
      roles: seedUser.roles,
      permissionRefs: seedUser.permissionRefs
    });
  }

  private async upsertAuthUser(email: string, displayLabel: string): Promise<AuthUserRow> {
    const now = new Date();
    const { rows } = await this.pool.query<AuthUserRow>(
      `
        insert into "user" (id, name, email, "emailVerified", "createdAt", "updatedAt")
        values ($1, $2, $3, true, $4, $4)
        on conflict (email)
        do update set
          name = excluded.name,
          "emailVerified" = true,
          "updatedAt" = excluded."updatedAt"
        returning id, email, name
      `,
      [createAuthId("usr"), displayLabel, email, now]
    );
    const row = rows[0];
    if (!row) {
      throw new AppError("INTERNAL", `Failed to seed standalone auth user '${email}'`);
    }
    return row;
  }

  private async upsertCredentialAccount(authUserId: string, password: string): Promise<void> {
    const now = new Date();
    const passwordHash = await hashPassword(password);
    await this.pool.query(
      `
        insert into account (
          id,
          "accountId",
          "providerId",
          "userId",
          password,
          "createdAt",
          "updatedAt"
        )
        values ($1, $2, 'credential', $2, $3, $4, $4)
        on conflict ("accountId", "providerId")
        do update set
          password = excluded.password,
          "updatedAt" = excluded."updatedAt"
      `,
      [createAuthId("acc"), authUserId, passwordHash, now]
    );
  }

  private async upsertProfile(input: {
    authUserId: string;
    externalUserId: string;
    displayLabel: string;
    roles: string[];
    permissionRefs: string[];
  }): Promise<void> {
    const now = new Date();
    await this.pool.query(
      `
        insert into standalone_auth_profiles (
          client_instance_id,
          auth_user_id,
          external_user_id,
          display_label,
          roles,
          permission_refs,
          created_at,
          updated_at
        )
        values ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $7)
        on conflict (client_instance_id, auth_user_id)
        do update set
          external_user_id = excluded.external_user_id,
          display_label = excluded.display_label,
          roles = excluded.roles,
          permission_refs = excluded.permission_refs,
          updated_at = excluded.updated_at
      `,
      [
        this.clientInstanceId,
        input.authUserId,
        input.externalUserId,
        input.displayLabel,
        JSON.stringify(input.roles),
        JSON.stringify(input.permissionRefs),
        now
      ]
    );
  }
}

function createAuthId(prefix: string): string {
  return `${prefix}_${randomUUID()}`;
}
