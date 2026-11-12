// src/modules/audit/audit.controller.ts
import {Request, Response} from "express";
import catchAsync from "../../common/utils/catch-async";
import {AppError} from "../../common/utils/errors";
import Messages from "../../common/utils/messages";
import {AuditService} from "./audit.service";
import {AuditOutcome} from "./audit.interface";

/**
 * HTTP adapter for the audit read API.
 *
 * Transport concerns (query parsing, pagination normalization and
 * response shaping) live here; the service owns the query.
 */
export class AuditController {
    constructor(
        private readonly auditService: AuditService,
    ) {
    }

    browse = catchAsync(async (req: Request, res: Response): Promise<void> => {
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

        const result = await this.auditService.browse({
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
    });
}
