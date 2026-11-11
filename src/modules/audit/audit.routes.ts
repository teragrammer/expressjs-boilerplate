// src/modules/audit/audit.routes.ts
import {Router} from "express";
import catchAsync from "../../common/utils/catch-async";
import {AuthenticationMiddleware} from "../../common/middleware/authentication.middleware";
import {AuthorizationMiddleware} from "../../common/middleware/authorization.middleware";
import {AppError} from "../../common/utils/errors";
import Messages from "../../common/utils/messages";
import {auditService} from "../../config/container";
import {AuditOutcome} from "./audit.interface";

export default () => {
    const router = Router();

    /**
     * Reads audit events.
     *
     * Restricted to the `audit:view` route guard. Auditors and admins
     * use this endpoint to trace a request id or an actor.
     */
    router.get(
        "/",
        [
            AuthenticationMiddleware(),
            AuthorizationMiddleware("audit:view"),
        ],
        catchAsync(async (req, res) => {
            const page = Math.max(1, Number(req.query.page) || 1);
            const perPage = Math.min(
                100,
                Math.max(1, Number(req.query.per_page) || 20),
            );

            const actorUserId = req.query.actor_user_id
                ? Number(req.query.actor_user_id)
                : undefined;

            if (
                actorUserId !== undefined &&
                !Number.isSafeInteger(actorUserId)
            ) {
                throw new AppError(Messages.INVALID_PATH_PARAM);
            }

            const action = req.query.action
                ? String(req.query.action)
                : undefined;

            const outcome = req.query.outcome
                ? (String(req.query.outcome) as AuditOutcome)
                : undefined;

            const result = await auditService.browse({
                actorUserId,
                action,
                outcome,
                page,
                perPage,
            });

            res.status(200).json({
                items: result.items,
                total: result.total,
                page,
                per_page: perPage,
            });
        }),
    );

    return router;
};
