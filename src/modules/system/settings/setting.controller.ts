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
        const isDisabled = req.sanitize.query.numeric("is_disabled",);
        const isPublic = req.sanitize.query.numeric("is_public",);

        const type = req.sanitize.query.get("type");
        const search: string = req.sanitize.query.get("search");


        const filters: BrowseSettingQuery = {
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
            ...(isDisabled !== null && {
                is_disabled: isDisabled === 1,
            }),
            ...(isPublic !== null && {
                is_public: isPublic === 1,
            }),
            ...(type !== null && {
                type: type as SettingDataType,
            }),
            ...(search !== null && {
                search: search.trim(),
            }),
        };

        const settings: Setting[] = await this.settingService.browseSettings(filters);
        res.status(200).json(settings);
    });


    values = catchAsync(async (req: Request, res: Response): Promise<any> => {
        res.status(200).json((await this.settingService.initializer()).pub);
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