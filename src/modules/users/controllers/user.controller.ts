// src/modules/users/controllers/user.controller.ts
import {Request, Response} from "express";
import catchAsync from "../../../common/utils/catch-async";
import {UserService} from "../services/user.service";
import {BrowseUsersResult, CreateUserDTO, UpdateUserDTO, User} from "../user.interface";
import {AppError} from "../../../common/utils/errors";
import Messages from "../../../common/utils/messages";

export class UserController {
    constructor(
        private readonly userService: UserService,
    ) {
    }

    create = catchAsync(async (req: Request, res: Response): Promise<any> => {
        const user: User = await this.userService.createUser(req.sanitize.data as unknown as CreateUserDTO);
        res.status(200).json({id: user.id});
    });

    update = catchAsync(async (req: Request, res: Response): Promise<any> => {
        const id = Number(req.params.id);
        await this.userService.updateUser(id, req.sanitize.data as UpdateUserDTO);
        res.status(200).send();
    });

    browse = catchAsync(async (req: Request, res: Response): Promise<any> => {
        /*
         * Cursor-based pagination
         *
         * First request:
         *   GET /users?limit=20
         *
         * The response contains:
         *   {
         *       "hasMore": true,
         *       "nextCursor": 481
         *   }
         *
         * To fetch the next page, send the returned cursor:
         *   GET /users?limit=20&cursor=481
         *
         * IMPORTANT:
         * - The cursor must come from the previous response's `nextCursor`.
         * - Do not calculate or modify the cursor on the client.
         * - When using a cursor, keep the same filters/search parameters.
         *
         * Example:
         *   GET /users?role_id=2&status=Activated&limit=20
         *
         * Next page:
         *   GET /users?role_id=2&status=Activated&limit=20&cursor=481
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
        res.status(200).send();
    });
}