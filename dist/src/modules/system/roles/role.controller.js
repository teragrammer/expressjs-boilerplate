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
exports.RoleController = void 0;
const messages_1 = require("../../../common/utils/messages");
const catch_async_1 = __importDefault(require("../../../common/utils/catch-async"));
const errors_1 = require("../../../common/utils/errors");
const query_parser_1 = require("../../../common/utils/query-parser");
const audit_interface_1 = require("../../audit/audit.interface");
class RoleController {
    constructor(roleService, auditService) {
        this.roleService = roleService;
        this.auditService = auditService;
        this.create = (0, catch_async_1.default)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const role = yield this.roleService.createRole(req.sanitize.data);
            yield this.auditService.success(audit_interface_1.AUDIT_ACTIONS.ROLE_CREATED, {
                request: req,
                targetType: "role",
                targetId: role.id,
                metadata: { slug: role.slug },
            });
            res.status(201).json({ id: role.id });
        }));
        this.update = (0, catch_async_1.default)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const id = Number(req.params.id);
            if (!Number.isSafeInteger(id) || id <= 0) {
                throw new errors_1.AppError(messages_1.Messages.INVALID_PATH_PARAM);
            }
            const role = yield this.roleService.updateRole(id, req.sanitize.data);
            res.status(200).json({ id: role.id });
        }));
        this.browse = (0, catch_async_1.default)((req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e;
            /*
             * Absent parameters must stay absent: a missing filter is not
             * the same as `is_public=false`.
             */
            const isPublic = (0, query_parser_1.parseOptionalBoolean)(req.sanitize.query.get("is_public"), "is_public");
            const search = (0, query_parser_1.parseOptionalSearch)(req.sanitize.query.get("search"));
            const paginate = (_a = req.pagination) !== null && _a !== void 0 ? _a : (_c = (_b = req.app) === null || _b === void 0 ? void 0 : _b.get) === null || _c === void 0 ? void 0 : _c.call(_b, "paginate");
            if (!paginate) {
                throw new TypeError("Missing pagination context");
            }
            const filters = Object.assign(Object.assign({ page: Math.max(1, (_d = paginate.page) !== null && _d !== void 0 ? _d : 1), perPage: Math.min(100, Math.max(1, (_e = paginate.perPage) !== null && _e !== void 0 ? _e : 20)) }, (isPublic !== undefined && { is_public: isPublic })), (search !== undefined && { search }));
            const roles = yield this.roleService.browseRoles(filters);
            res.status(200).json(roles);
        }));
        this.view = (0, catch_async_1.default)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const id = Number(req.params.id);
            if (!Number.isSafeInteger(id) || id <= 0) {
                throw new errors_1.AppError(messages_1.Messages.INVALID_PATH_PARAM);
            }
            const role = yield this.roleService.findById(id);
            res.status(200).json(role);
        }));
        this.delete = (0, catch_async_1.default)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const id = Number(req.params.id);
            if (!Number.isSafeInteger(id) || id <= 0) {
                throw new errors_1.AppError(messages_1.Messages.INVALID_PATH_PARAM);
            }
            yield this.roleService.hardDelete(id);
            yield this.auditService.success(audit_interface_1.AUDIT_ACTIONS.ROLE_DELETED, {
                request: req,
                targetType: "role",
                targetId: id,
            });
            res.status(200).send();
        }));
    }
}
exports.RoleController = RoleController;
