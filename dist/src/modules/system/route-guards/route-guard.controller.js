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
exports.RouteGuardController = void 0;
const messages_1 = require("../../../common/utils/messages");
const catch_async_1 = __importDefault(require("../../../common/utils/catch-async"));
const errors_1 = require("../../../common/utils/errors");
class RouteGuardController {
    constructor(routeGuardService) {
        this.routeGuardService = routeGuardService;
        this.create = (0, catch_async_1.default)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const routeGuard = yield this.routeGuardService.createRouteGuard(req.sanitize.data);
            res.status(200).json({ id: routeGuard.id });
        }));
        this.browse = (0, catch_async_1.default)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const roleId = req.sanitize.query.numeric("role_id");
            const filters = Object.assign({ page: (() => {
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
                })() }, (roleId !== null && {
                role_id: roleId,
            }));
            const routeGuards = yield this.routeGuardService.browseRouteGuards(filters);
            res.status(200).json(routeGuards);
        }));
        this.view = (0, catch_async_1.default)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const id = Number(req.params.id);
            if (!Number.isSafeInteger(id) || id <= 0) {
                throw new errors_1.AppError(messages_1.Messages.INVALID_PATH_PARAM);
            }
            const routeGuard = yield this.routeGuardService.findById(id);
            res.status(200).json(routeGuard);
        }));
        this.delete = (0, catch_async_1.default)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const id = Number(req.params.id);
            if (!Number.isSafeInteger(id) || id <= 0) {
                throw new errors_1.AppError(messages_1.Messages.INVALID_PATH_PARAM);
            }
            yield this.routeGuardService.hardDelete(id);
            res.status(200).send();
        }));
    }
}
exports.RouteGuardController = RouteGuardController;
