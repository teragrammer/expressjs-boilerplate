// src/modules/system/roles/role.controller.ts
import {Request, Response} from "express";
import {Messages} from "../../../common/utils/messages";
import catchAsync from "../../../common/utils/catch-async";
import {RoleService} from "./role.service";
import {
    BrowseRoleQuery,
    CreateRoleDTO,
    Role,
    UpdateRoleDTO,
} from "./role.interface";
import {AppError} from "../../../common/utils/errors";
import {
    parseOptionalBoolean,
    parseOptionalSearch,
} from "../../../common/utils/query-parser";
import {AuditService} from "../../audit/audit.service";
import {AUDIT_ACTIONS} from "../../audit/audit.interface";

export class RoleController {
    constructor(
        private readonly roleService: RoleService,
        private readonly auditService: AuditService,
    ) {
    }

    create = catchAsync(async (req: Request, res: Response): Promise<void> => {
        const role: Role = await this.roleService.createRole(
            req.sanitize.data as unknown as CreateRoleDTO,
        );

        await this.auditService.success(AUDIT_ACTIONS.ROLE_CREATED, {
            request: req,
            targetType: "role",
            targetId: role.id,
            metadata: {slug: role.slug},
        });

        res.status(201).json({id: role.id});
    });

    update = catchAsync(async (req: Request, res: Response): Promise<void> => {
        const id = Number(req.params.id);

        if (!Number.isSafeInteger(id) || id <= 0) {
            throw new AppError(Messages.INVALID_PATH_PARAM);
        }

        const role: Role = await this.roleService.updateRole(
            id,
            req.sanitize.data as UpdateRoleDTO,
        );

        res.status(200).json({id: role.id});
    });

    browse = catchAsync(async (req: Request, res: Response): Promise<void> => {
        /*
         * Absent parameters must stay absent: a missing filter is not
         * the same as `is_public=false`.
         */
        const isPublic = parseOptionalBoolean(
            req.sanitize.query.get("is_public"),
            "is_public",
        );

        const search = parseOptionalSearch(req.sanitize.query.get("search"));

        const paginate = req.pagination ?? req.app?.get?.("paginate");
        if (!paginate) {throw new TypeError("Missing pagination context");}

        const filters: BrowseRoleQuery = {
            page: Math.max(1, paginate.page ?? 1),
            perPage: Math.min(100, Math.max(1, paginate.perPage ?? 20)),
            ...(isPublic !== undefined && {is_public: isPublic}),
            ...(search !== undefined && {search}),
        };

        const roles: Role[] = await this.roleService.browseRoles(filters);

        res.status(200).json(roles);
    });

    view = catchAsync(async (req: Request, res: Response): Promise<void> => {
        const id = Number(req.params.id);
        if (!Number.isSafeInteger(id) || id <= 0) {
            throw new AppError(Messages.INVALID_PATH_PARAM);
        }

        const role: Role = await this.roleService.findById(id);
        res.status(200).json(role);
    });

    delete = catchAsync(async (req: Request, res: Response): Promise<void> => {
        const id = Number(req.params.id);
        if (!Number.isSafeInteger(id) || id <= 0) {
            throw new AppError(Messages.INVALID_PATH_PARAM);
        }

        await this.roleService.hardDelete(id);

        await this.auditService.success(AUDIT_ACTIONS.ROLE_DELETED, {
            request: req,
            targetType: "role",
            targetId: id,
        });

        res.status(200).send();
    });
}
