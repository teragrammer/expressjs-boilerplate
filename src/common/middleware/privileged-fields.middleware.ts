// src/common/middleware/privileged-fields.middleware.ts
import {NextFunction, Request, Response} from "express";
import {AppError} from "../utils/errors";
import Messages from "../utils/messages";
import {resolveActor} from "../utils/actor";
import {
    PRIVILEGED_USER_FIELDS,
} from "../authz/policy";

/**
 * Roles that may set the privileged user fields.
 */
const ADMINISTRATIVE_ROLES = new Set(["admin"]);

/**
 * Rejects a request that changes a privileged field.
 *
 * The check runs before the schema validation, so a caller without the
 * permission cannot use the endpoint to probe which values exist.
 */
export function privilegedFieldsMiddleware(
    fields: readonly string[] = PRIVILEGED_USER_FIELDS,
) {
    return async function privilegedFields(
        req: Request,
        _res: Response,
        next: NextFunction,
    ): Promise<void> {
        try {
            const actor = resolveActor(req);

            if (actor.bypass || ADMINISTRATIVE_ROLES.has(actor.roleSlug)) {
                next();
                return;
            }

            const body = (req.body ?? {}) as Record<string, unknown>;

            const attempted = fields.filter(
                (field) => body[field] !== undefined,
            );

            if (attempted.length > 0) {
                throw new AppError(
                    Messages.NO_PERMISSION,
                    `Changing '${attempted.join(", ")}' requires an administrator.`,
                );
            }

            next();
        } catch (error) {
            next(error);
        }
    };
}
