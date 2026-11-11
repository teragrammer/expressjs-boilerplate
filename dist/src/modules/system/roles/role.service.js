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
exports.RoleService = void 0;
const errors_1 = require("../../../common/utils/errors");
const messages_1 = __importDefault(require("../../../common/utils/messages"));
class RoleService {
    constructor(roleRepository) {
        this.roleRepository = roleRepository;
    }
    /**
     * Retrieves a role by its slug or throws an error if not found.
     */
    getRoleBySlug(slug) {
        return __awaiter(this, void 0, void 0, function* () {
            const role = yield this.roleRepository.findBySlug(slug);
            if (!role) {
                throw new errors_1.AppError(messages_1.default.DATA_NOT_FOUND, `Role with slug '${slug}' not found`);
            }
            return role;
        });
    }
    createRole(data) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.roleRepository.create(data);
        });
    }
    updateRole(id, data) {
        return __awaiter(this, void 0, void 0, function* () {
            const role = yield this.roleRepository.update(id, data);
            if (!role) {
                throw new errors_1.AppError(messages_1.default.DATA_NOT_FOUND);
            }
            return role;
        });
    }
    browseRoles(filters) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const MAX_PER_PAGE = 100;
            const page = Math.max(1, filters.page || 1);
            const perPage = Math.min(MAX_PER_PAGE, Math.max(1, filters.perPage || 20));
            const normalizedFilters = Object.assign(Object.assign({}, filters), { page,
                perPage, search: ((_a = filters.search) === null || _a === void 0 ? void 0 : _a.trim()) || undefined });
            return this.roleRepository.browse(normalizedFilters);
        });
    }
    findById(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const role = yield this.roleRepository.findById(id);
            if (!role) {
                throw new errors_1.AppError(messages_1.default.DATA_NOT_FOUND);
            }
            return role;
        });
    }
    /**
     * Deletes a role.
     *
     * The foreign keys use `ON DELETE RESTRICT`, so a role that is
     * still assigned to users or route guards cannot be removed. The
     * check is explicit so the client receives a 409 with a clear
     * message instead of a generic database error.
     */
    hardDelete(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const role = yield this.roleRepository.findById(id);
            if (!role) {
                throw new errors_1.AppError(messages_1.default.DATA_NOT_FOUND);
            }
            const inUse = yield this.roleRepository.countUsers(id);
            const guardCount = yield this.roleRepository.countRouteGuards(id);
            if (inUse > 0 || guardCount > 0) {
                throw new errors_1.AppError(messages_1.default.DUPLICATE_DATA, "This role is still assigned to users or route guards. " +
                    "Reassign or remove them before deleting the role.");
            }
            const deleted = yield this.roleRepository.delete(id);
            if (!deleted) {
                throw new errors_1.AppError(messages_1.default.DATA_NOT_FOUND);
            }
        });
    }
}
exports.RoleService = RoleService;
