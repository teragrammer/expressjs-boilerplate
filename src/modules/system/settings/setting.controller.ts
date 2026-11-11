// src/modules/system/settings/setting.controller.ts
import {Request, Response} from "express";
import {Messages} from "../../../common/utils/messages";
import catchAsync from "../../../common/utils/catch-async";
import {SettingService} from "./setting.service";
import {
    BrowseSettingQuery,
    CreateSettingDTO,
    Setting,
    SettingDataType,
    UpdateSettingDTO
} from "./setting.interface";
import {AppError} from "../../../common/utils/errors";
import {
    parseOptionalBoolean,
    parseOptionalEnum,
    parseOptionalSearch,
} from "../../../common/utils/query-parser";

export class SettingController {
    constructor(
        private readonly settingService: SettingService,
    ) {
    }

    create = catchAsync(async (req: Request, res: Response): Promise<void> => {
        const setting: Setting = await this.settingService.createSetting(req.sanitize.data as unknown as CreateSettingDTO)
        res.status(201).json({id: setting.id});
    });

    update = catchAsync(async (req: Request, res: Response): Promise<void> => {
        const id = Number(req.params.id);
        if (!Number.isSafeInteger(id) || id <= 0) {
            throw new AppError(Messages.INVALID_PATH_PARAM);
        }

        const setting: Setting = await this.settingService.updateSetting(id, req.sanitize.data as UpdateSettingDTO)
        res.status(200).json({id: setting.id});
    });

    browse = catchAsync(async (req: Request, res: Response): Promise<void> => {
        /*
         * Absent parameters must stay absent: a missing filter is not
         * the same as `is_disabled=false`.
         */
        const isDisabled = parseOptionalBoolean(
            req.sanitize.query.get("is_disabled"),
            "is_disabled",
        );
        const isPublic = parseOptionalBoolean(
            req.sanitize.query.get("is_public"),
            "is_public",
        );

        const type = parseOptionalEnum(
            req.sanitize.query.get("type"),
            ["string", "integer", "float", "boolean", "array"] as const,
            "type",
        );

        const search = parseOptionalSearch(req.sanitize.query.get("search"));

        const paginate = req.pagination ?? req.app?.get?.("paginate");
        if (!paginate) {throw new TypeError("Missing pagination context");}

        const filters: BrowseSettingQuery = {
            page: Math.max(1, paginate.page ?? 1),
            perPage: Math.min(100, Math.max(1, paginate.perPage ?? 20)),
            ...(isDisabled !== undefined && {is_disabled: isDisabled}),
            ...(isPublic !== undefined && {is_public: isPublic}),
            ...(type !== undefined && {type}),
            ...(search !== undefined && {search}),
        };

        const settings: Setting[] = await this.settingService.browseSettings(filters);
        res.status(200).json(settings);
    });


    /**
     * Public settings values.
     *
     * Served from the same cache the application uses internally, so
     * a request does not run two database queries.
     */
    values = catchAsync(async (req: Request, res: Response): Promise<any> => {
        const settings = await this.settingService.getCache();

        res.status(200).json(settings.pub);
    });

    view = catchAsync(async (req: Request, res: Response): Promise<void> => {
        const id = Number(req.params.id);
        if (!Number.isSafeInteger(id) || id <= 0) {
            throw new AppError(Messages.INVALID_PATH_PARAM);
        }

        const setting: Setting = await this.settingService.findById(id);
        res.status(200).json(setting);
    });

    delete = catchAsync(async (req: Request, res: Response): Promise<void> => {
        const id = Number(req.params.id);
        if (!Number.isSafeInteger(id) || id <= 0) {
            throw new AppError(Messages.INVALID_PATH_PARAM);
        }

        await this.settingService.hardDelete(id);
        res.status(200).send();
    });
}