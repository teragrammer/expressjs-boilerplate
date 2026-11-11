// src/modules/users/controllers/user.controller.ts
// src/modules/users/controllers/user.controller.ts
import {Request, Response} from "express";
import catchAsync from "../../../common/utils/catch-async";
import {UserService} from "../services/user.service";
import {UserPurgeService} from "../services/user-purge.service";
import {BrowseUsersResult, CreateUserDTO, UpdateUserDTO, User} from "../user.interface";
import {AppError} from "../../../common/utils/errors";
import Messages from "../../../common/utils/messages";
import {resolveActor} from "../../../common/utils/actor";
import {AuditService} from "../../audit/audit.service";
import {AUDIT_ACTIONS} from "../../audit/audit.interface";

export class UserController {
    constructor(
        private readonly userService: UserService,
        private readonly userPurgeService: UserPurgeService,
        private readonly auditService: AuditService,
    ) {
    }

    create = catchAsync(async (req: Request, res: Response): Promise<any> => {
        const user: User = await this.userService.createUser(
            req.sanitize.data as unknown as CreateUserDTO,
            resolveActor(req),
        );

        await this.auditService.success(AUDIT_ACTIONS.USER_CREATED, {
            request: req,
            targetType: "user",
            targetId: user.id,
            metadata: {role_id: user.role_id},
        });

        res.status(200).json({id: user.id});
    });

    update = catchAsync(async (req: Request, res: Response): Promise<any> => {
        const id = Number(req.params.id);

        if (!Number.isSafeInteger(id) || id <= 0) {
            throw new AppError(Messages.INVALID_PATH_PARAM);
        }

        const data = req.sanitize.data as unknown as UpdateUserDTO;

        const user: User = await this.userService.updateUser(
            id,
            data,
            resolveActor(req),
        );

        /*
         * A role or status change is a privilege change: it is
         * recorded separately so the trail shows what was granted or
         * revoked.
         */
        if (data.role_id !== undefined) {
            await this.auditService.success(
                AUDIT_ACTIONS.USER_ROLE_CHANGED,
                {
                    request: req,
                    targetType: "user",
                    targetId: id,
                    metadata: {role_id: data.role_id},
                },
            );
        }

        if (data.status !== undefined) {
            await this.auditService.success(
                AUDIT_ACTIONS.USER_STATUS_CHANGED,
                {
                    request: req,
                    targetType: "user",
                    targetId: id,
                    metadata: {status: data.status},
                },
            );
        }

        await this.auditService.success(AUDIT_ACTIONS.USER_UPDATED, {
            request: req,
            targetType: "user",
            targetId: id,
            metadata: {authorization_version: user.authorization_version},
        });

        res.status(200).send();
    });

    browse = catchAsync(async (req: Request, res: Response): Promise<any> => {
        /*
         * Cursor-based pagination.
         *
         * First request:
         *   GET /users?per_page=20
         *
         * The response contains:
         *   {
         *       "hasMore": true,
         *       "nextCursor": 481
         *   }
         *
         * To fetch the next page, send the returned cursor:
         *   GET /users?per_page=20&cursor=481
         *
         * IMPORTANT:
         * - The cursor must come from the previous response's `nextCursor`.
         * - Do not calculate or modify the cursor on the client.
         * - When using a cursor, keep the same filters/search parameters.
         *
         * Example:
         *   GET /users?role_id=2&status=Activated&per_page=20
         *
         * Next page:
         *   GET /users?role_id=2&status=Activated&per_page=20&cursor=481
         *
         * When `hasMore` is false, `nextCursor` will be null and there
         * are no more records to fetch.
         */

        const result: BrowseUsersResult = await this.userService.browseUsers({
            role_id: req.sanitize.query.numeric("role_id") || undefined,
            status: req.sanitize.query.get("status") || undefined,
            search: req.sanitize.query.get("search") || undefined,

            // `undefined` on the first request means "start from the newest user".
            // On subsequent requests, this is the `nextCursor` returned by the
            // previous API response.
            cursor: req.cursorPagination.cursor,

            // Maximum number of records returned in one request.
            limit: req.cursorPagination.perPage,
        });

        res.status(200).json(result);
    });

    view = catchAsync(async (req: Request, res: Response): Promise<any> => {
        const id = Number(req.params.id);
        if (!Number.isSafeInteger(id) || id <= 0) {
            throw new AppError(Messages.INVALID_PATH_PARAM);
        }

        const user: User = await this.userService.findById(id);
        return res.status(200).json(user);
    });

    delete = catchAsync(async (req: Request, res: Response): Promise<any> => {
        const id = Number(req.params.id);
        if (!Number.isSafeInteger(id) || id <= 0) {
            throw new AppError(Messages.INVALID_PATH_PARAM);
        }

        await this.userService.softDelete(id);

        await this.auditService.success(AUDIT_ACTIONS.USER_DELETED, {
            request: req,
            targetType: "user",
            targetId: id,
            metadata: {permanent: false},
        });

        res.status(200).send();
    });

    /**
     * Permanently removes a user.
     *
     * The reason is required and is recorded in the audit trail.
     */
    purge = catchAsync(async (req: Request, res: Response): Promise<any> => {
        const id = Number(req.params.id);
        if (!Number.isSafeInteger(id) || id <= 0) {
            throw new AppError(Messages.INVALID_PATH_PARAM);
        }

        const reason = req.get("X-Deletion-Reason") ?? "";

        await this.userPurgeService.purge(
            id,
            resolveActor(req),
            reason,
            req,
        );

        res.status(200).send();
    });
}
