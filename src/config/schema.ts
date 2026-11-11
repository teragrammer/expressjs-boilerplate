// src/config/schema.ts
import type {ColumnType, Generated} from "kysely";

/**
 * Non-nullable PostgreSQL timestamp (timestamptz) with a database default.
 *
 * Selects come back as `Date`; inserts/updates also accept ISO strings
 * and may be omitted when the database supplies the default.
 */
export type GeneratedTimestamp = ColumnType<
    Date,
    Date | string | undefined,
    Date | string
>;

/**
 * Nullable PostgreSQL timestamp (timestamptz).
 *
 * Selects come back as `Date | null`; inserts/updates also accept
 * ISO strings and may be omitted (defaults to NULL).
 */
export type NullableTimestamp = ColumnType<
    Date | null,
    Date | string | null | undefined,
    Date | string | null
>;

/**
 * Non-nullable PostgreSQL timestamp (timestamptz) without a default.
 *
 * A value must always be supplied on insert.
 */
export type RequiredTimestamp = ColumnType<
    Date,
    Date | string,
    Date | string
>;

export interface UsersTable {
    id: Generated<number>;
    first_name: string | null;
    middle_name: string | null;
    last_name: string | null;
    gender: "Male" | "Female" | "Other" | null;
    address: string | null;
    phone: string | null;
    is_phone_verified: Generated<boolean>;
    email: string | null;
    is_email_verified: Generated<boolean>;
    has_tfa: Generated<boolean>;
    tfa_secret: string | null;
    role_id: number;
    username: string | null;
    password: string | null;
    status: Generated<"Activated" | "Suspended" | "Deactivated" | "Pending">;
    login_tries: Generated<number>;
    failed_login_expired_at: NullableTimestamp;
    comments: string | null;
    authorization_version: Generated<number>;
    created_at: GeneratedTimestamp;
    updated_at: GeneratedTimestamp;
    deleted_at: NullableTimestamp;
}

export interface RolesTable {
    id: Generated<number>;
    name: string;
    slug: string;
    description: string | null;
    is_public: Generated<boolean>;
    is_bypass_authorization: Generated<boolean>;
    created_at: GeneratedTimestamp;
    updated_at: GeneratedTimestamp;
}

export interface SettingsTable {
    id: Generated<number>;
    name: string;
    slug: string;
    value: string | null;
    description: string | null;
    type: "string" | "integer" | "float" | "boolean" | "array";
    is_disabled: Generated<boolean>;
    is_public: Generated<boolean>;
    created_at: GeneratedTimestamp;
    updated_at: GeneratedTimestamp;
}

export interface RouteGuardsTable {
    id: Generated<number>;
    role_id: number;
    route: string;
    created_at: GeneratedTimestamp;
    updated_at: GeneratedTimestamp;
}

export interface AuthenticationTokensTable {
    id: Generated<number>;
    user_id: number | null;
    tries: Generated<number>;
    expired_at: RequiredTimestamp;
    ip: string | null;
    browser: string | null;
    os: string | null;
    created_at: NullableTimestamp;
    updated_at: NullableTimestamp;
}

export interface PasswordRecoveriesTable {
    id: Generated<number>;
    type: "email" | "phone";
    send_to: string;
    code: string;
    next_resend_at: RequiredTimestamp;
    expired_at: RequiredTimestamp;
    tries: number;
    next_try_at: NullableTimestamp;
    user_id: number | null;
    created_at: GeneratedTimestamp;
    updated_at: GeneratedTimestamp;
}

export interface TwoFactorAuthenticationsTable {
    id: Generated<number>;
    token_id: number;
    code: string;
    tries: number;
    next_send_at: NullableTimestamp;
    expired_tries_at: NullableTimestamp;
    expired_at: NullableTimestamp;
    created_at: GeneratedTimestamp;
    updated_at: GeneratedTimestamp;
}

export interface RateLimitsTable {
    id: Generated<number>;
    key: string;
    bucket: string;
    count: number;
    expires_at: RequiredTimestamp;
    created_at: GeneratedTimestamp;
    updated_at: GeneratedTimestamp;
}

export interface RefreshTokensTable {
    id: Generated<string>;
    session_id: number;
    user_id: number;
    token_hash: string;
    family_id: string;
    expires_at: RequiredTimestamp;
    revoked_at: NullableTimestamp;
    replaced_by: string | null;
    ip: string | null;
    user_agent: string | null;
    created_at: GeneratedTimestamp;
    updated_at: GeneratedTimestamp;
}

export interface VerificationTokensTable {
    id: Generated<string>;
    user_id: number;
    channel: "email" | "phone";
    target: string;
    token_hash: string;
    expires_at: RequiredTimestamp;
    consumed_at: NullableTimestamp;
    attempts: Generated<number>;
    created_at: GeneratedTimestamp;
    updated_at: GeneratedTimestamp;
}

export interface AuditLogsTable {
    id: Generated<string>;
    occurred_at: GeneratedTimestamp;
    actor_user_id: number | null;
    actor_type: string;
    action: string;
    target_type: string | null;
    target_id: string | null;
    outcome: "success" | "failure";
    request_id: string | null;
    ip: string | null;
    user_agent: string | null;
    metadata: Generated<Record<string, unknown>>;
}

export interface OutboxEventsTable {
    id: Generated<string>;
    type: string;
    payload: Generated<Record<string, unknown>>;
    status: "pending" | "processing" | "done" | "failed";
    attempts: Generated<number>;
    available_at: GeneratedTimestamp;
    locked_at: NullableTimestamp;
    locked_by: string | null;
    last_error: string | null;
    created_at: GeneratedTimestamp;
    updated_at: GeneratedTimestamp;
    processed_at: NullableTimestamp;
}

export interface IdempotencyKeysTable {
    id: Generated<string>;
    key: string;
    user_id: number | null;
    route: string;
    request_hash: string;
    status: "in_progress" | "completed";
    response_status: number | null;
    response_body: Record<string, unknown> | null;
    locked_at: NullableTimestamp;
    created_at: GeneratedTimestamp;
    expires_at: RequiredTimestamp;
}

/**
 * Kysely database schema.
 *
 * Table names match the original schema exactly so existing
 * databases keep working without a re-baseline of stored data.
 */
export interface Database {
    users: UsersTable;
    roles: RolesTable;
    settings: SettingsTable;
    route_guards: RouteGuardsTable;
    authentication_tokens: AuthenticationTokensTable;
    password_recoveries: PasswordRecoveriesTable;
    two_factor_authentications: TwoFactorAuthenticationsTable;
    rate_limits: RateLimitsTable;
    refresh_tokens: RefreshTokensTable;
    verification_tokens: VerificationTokensTable;
    audit_logs: AuditLogsTable;
    outbox_events: OutboxEventsTable;
    idempotency_keys: IdempotencyKeysTable;
}
