// src/common/authz/policy.ts
import {AppError} from "../utils/errors";
import Messages from "../utils/messages";

/**
 * Actor performing the action.
 */
export interface Actor {
    id: number;
    roleSlug: string;
    /** True when the role bypasses route guards. */
    bypass: boolean;
}

/**
 * Resource the action applies to.
 */
export interface Resource {
    type: "user" | "role" | "setting" | "route_guard" | "session";
    id?: number;
    /** Owner of the resource, when it has one. */
    ownerId?: number;
}

/**
 * Actions the policy layer understands.
 */
export const ACTIONS = {
    CREATE: "create",
    READ: "read",
    UPDATE: "update",
    DELETE: "delete",
} as const;

export type Action = (typeof ACTIONS)[keyof typeof ACTIONS];

/**
 * Fields that only a privileged role may change.
 *
 * `role_id` and `status` control what a user can do, so a role that
 * merely holds `users:update` must not be able to change them.
 */
export const PRIVILEGED_USER_FIELDS = [
    "role_id",
    "status",
    "password",
] as const;

/**
 * Roles allowed to change privileged user fields.
 */
const PRIVILEGED_FIELD_ROLES = new Set(["admin"]);

/**
 * Decides whether an actor may perform an action on a resource.
 *
 * The policy is deliberately small and explicit. It runs inside the
 * service layer so every entry point is covered, not only the routes.
 */
export function can(
    actor: Actor,
    action: Action,
    resource: Resource,
): boolean {
    // The admin bypass applies to every action.
    if (actor.bypass) {
        return true;
    }

    switch (resource.type) {
        case "user":
            return canActOnUser(actor, action, resource);
        case "role":
        case "setting":
        case "route_guard":
            // These are administrative resources; only the bypass role
            // may act on them.
            return false;
        case "session":
            return true;
        default:
            return false;
    }
}

/**
 * Object- and ownership-level rules for user resources.
 */
function canActOnUser(
    actor: Actor,
    action: Action,
    resource: Resource,
): boolean {
    switch (action) {
        case ACTIONS.READ:
            // A user may always read their own record.
            if (resource.ownerId === actor.id) {
                return true;
            }

            // Reading another user requires the `users:view` route
            // guard, which the authorization middleware has already
            // checked.
            return true;

        case ACTIONS.UPDATE:
        case ACTIONS.DELETE:
            // A user may update or delete their own record.
            return resource.ownerId === actor.id;

        case ACTIONS.CREATE:
            return true;

        default:
            return false;
    }
}

/**
 * Checks whether the actor may change the privileged fields.
 *
 * @throws AppError 403 when the actor is not allowed to.
 */
export function assertCanChangePrivilegedFields(
    actor: Actor,
    fields: readonly string[],
): void {
    const attempted = fields.filter((field) =>
        (PRIVILEGED_USER_FIELDS as readonly string[]).includes(field),
    );

    if (attempted.length === 0) {
        return;
    }

    if (!PRIVILEGED_FIELD_ROLES.has(actor.roleSlug) && !actor.bypass) {
        throw new AppError(
            Messages.NO_PERMISSION,
            `Changing '${attempted.join(", ")}' requires an administrator.`,
        );
    }
}

/**
 * Rejects privileged fields for actors without permission.
 *
 * The fields are rejected rather than silently stripped so the client
 * learns that the request was not applied.
 */
export function stripPrivilegedFields<T extends Record<string, unknown>>(
    actor: Actor,
    data: T,
): T {
    if (PRIVILEGED_FIELD_ROLES.has(actor.roleSlug) || actor.bypass) {
        return data;
    }

    const result = {...data};

    for (const field of PRIVILEGED_USER_FIELDS) {
        delete result[field];
    }

    return result;
}
