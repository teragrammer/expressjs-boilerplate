// src/modules/system/route-guards/route-guard.controller.ts
import {Request, Response} from "express";
import {Messages} from "../../../common/utils/messages";
import {CreateRouteGuardDTO, RouteGuard, RouteGuardRow} from "./route-guard.interface";
import catchAsync from "../../../common/utils/catch-async";
import {RouteGuardService} from "./route-guard.service";
import {AppError} from "../../../common/utils/errors";

export class RouteGuardController {
    constructor(
        private readonly routeGuardService: RouteGuardService,
    ) {
    }

    create = catchAsync(async (req: Request, res: Response): Promise<any> => {
        const routeGuard: RouteGuard = await this.routeGuardService.createRouteGuard(req.sanitize.data as unknown as CreateRouteGuardDTO);
        res.status(200).json({id: routeGuard.id});
    });

    browse = catchAsync(async (req: Request, res: Response): Promise<void> => {
        const roleId = req.sanitize.query.numeric("role_id");

        const filters = {
            page: (() => {
                const paginate = req.pagination ?? req.app?.get?.("paginate");
                if (!paginate) {throw new TypeError("Missing pagination context");}
                return Math.max(1, paginate.page ?? 1);
            })(),
            perPage: (() => {
                const paginate = req.pagination ?? req.app?.get?.("paginate");
                if (!paginate) {throw new TypeError("Missing pagination context");}
                return Math.min(100, Math.max(1, paginate.perPage ?? 20));
            })(),
            ...(roleId !== null && {
                role_id: roleId,
            }),
        };

        const routeGuards = await this.routeGuardService.browseRouteGuards(filters);

        res.status(200).json(routeGuards);
    });

    view = catchAsync(async (req: Request, res: Response): Promise<any> => {
        const id = Number(req.params.id);
        if (!Number.isSafeInteger(id) || id <= 0) {
            throw new AppError(Messages.INVALID_PATH_PARAM);
        }

        const routeGuard: RouteGuardRow = await this.routeGuardService.findById(id);
        res.status(200).json(routeGuard);
    });

    delete = catchAsync(async (req: Request, res: Response): Promise<any> => {
        const id = Number(req.params.id);
        if (!Number.isSafeInteger(id) || id <= 0) {
            throw new AppError(Messages.INVALID_PATH_PARAM);
        }

        await this.routeGuardService.hardDelete(id);
        res.status(200).send();
    });
}