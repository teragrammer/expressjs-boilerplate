"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SettingController = void 0;
const messages_1 = require("../../../common/utils/messages");
const catch_async_1 = __importDefault(require("../../../common/utils/catch-async"));
const errors_1 = require("../../../common/utils/errors");
class SettingController {
    constructor(settingService) {
        this.settingService = settingService;
        this.create = (0, catch_async_1.default)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const setting = yield this.settingService.createSetting(req.sanitize.data);
            res.status(201).json({ id: setting.id });
        }));
        this.update = (0, catch_async_1.default)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const id = Number(req.params.id);
            if (!Number.isSafeInteger(id) || id <= 0) {
                throw new errors_1.AppError(messages_1.Messages.INVALID_PATH_PARAM);
            }
            const setting = yield this.settingService.updateSetting(id, req.sanitize.data);
            res.status(200).json({ id: setting.id });
        }));
        this.browse = (0, catch_async_1.default)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const isDisabled = req.sanitize.query.numeric("is_disabled");
            const isPublic = req.sanitize.query.numeric("is_public");
            const type = req.sanitize.query.get("type");
            const search = req.sanitize.query.get("search");
            const filters = Object.assign(Object.assign(Object.assign(Object.assign({ page: (() => {
                    var _a, _b, _c, _d;
                    const paginate = (_a = req.pagination) !== null && _a !== void 0 ? _a : (_c = (_b = req.app) === null || _b === void 0 ? void 0 : _b.get) === null || _c === void 0 ? void 0 : _c.call(_b, "paginate");
                    if (!paginate) {
                        throw new TypeError("Missing pagination context");
                    }
                    return Math.max(1, (_d = paginate.page) !== null && _d !== void 0 ? _d : 1);
                })(), perPage: (() => {
                    var _a, _b, _c, _d;
                    const paginate = (_a = req.pagination) !== null && _a !== void 0 ? _a : (_c = (_b = req.app) === null || _b === void 0 ? void 0 : _b.get) === null || _c === void 0 ? void 0 : _c.call(_b, "paginate");
                    if (!paginate) {
                        throw new TypeError("Missing pagination context");
                    }
                    return Math.min(100, Math.max(1, (_d = paginate.perPage) !== null && _d !== void 0 ? _d : 20));
                })() }, (isDisabled !== null && {
                is_disabled: isDisabled === 1,
            })), (isPublic !== null && {
                is_public: isPublic === 1,
            })), (type !== null && {
                type: type,
            })), (search !== null && {
                search: search.trim(),
            }));
            const settings = yield this.settingService.browseSettings(filters);
            res.status(200).json(settings);
        }));
        this.values = (0, catch_async_1.default)((req, res) => __awaiter(this, void 0, void 0, function* () {
            res.status(200).json((yield this.settingService.initializer()).pub);
        }));
        this.view = (0, catch_async_1.default)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const id = Number(req.params.id);
            if (!Number.isSafeInteger(id) || id <= 0) {
                throw new errors_1.AppError(messages_1.Messages.INVALID_PATH_PARAM);
            }
            const setting = yield this.settingService.findById(id);
            res.status(200).json(setting);
        }));
        this.delete = (0, catch_async_1.default)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const id = Number(req.params.id);
            if (!Number.isSafeInteger(id) || id <= 0) {
                throw new errors_1.AppError(messages_1.Messages.INVALID_PATH_PARAM);
            }
            yield this.settingService.hardDelete(id);
            res.status(200).send();
        }));
    }
}
exports.SettingController = SettingController;
