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
exports.UserPurgeService = void 0;
const audit_interface_1 = require("../../audit/audit.interface");
const errors_1 = require("../../../common/utils/errors");
const messages_1 = __importDefault(require("../../../common/utils/messages"));
/**
 * Roles allowed to permanently remove a user.
 *
 * The hard delete destroys the account row and its history, so it is
 * reserved for a super-admin and always leaves an audit record.
 */
const PURGE_ROLES = new Set(["admin"]);
/**
 * Permanently removes a user.
 *
 * The standard delete endpoint performs a soft delete. This operation
 * is destructive: it requires a privileged role, a stated reason, and
 * it produces an audit event.
 */
class UserPurgeService {
    constructor(userRepository, authenticationTokenRepository, auditService) {
        this.userRepository = userRepository;
        this.authenticationTokenRepository = authenticationTokenRepository;
        this.auditService = auditService;
    }
    /**
     * Permanently deletes a user.
     *
     * @param reason why the account is being removed; recorded in the
     * audit trail.
     */
    purge(id, actor, reason, request) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            if (!PURGE_ROLES.has(actor.roleSlug) && !actor.bypass) {
                throw new errors_1.AppError(messages_1.default.NO_PERMISSION, "Permanently removing an account requires an administrator.");
            }
            const trimmedReason = (_a = reason === null || reason === void 0 ? void 0 : reason.trim()) !== null && _a !== void 0 ? _a : "";
            if (trimmedReason.length < 10) {
                throw new errors_1.AppError(messages_1.default.INVALID_REQUEST, "A reason of at least 10 characters is required to remove an account permanently.");
            }
            const user = yield this.userRepository.findAuthById(id);
            if (!user) {
                throw new errors_1.AppError(messages_1.default.DATA_NOT_FOUND);
            }
            // Revoke the sessions before the row disappears.
            yield this.authenticationTokenRepository.deleteAllByUserId(id);
            yield this.userRepository.hardDelete(id);
            yield this.auditService.success(audit_interface_1.AUDIT_ACTIONS.USER_DELETED, {
                request,
                actorUserId: actor.id,
                targetType: "user",
                targetId: id,
                metadata: {
                    reason: trimmedReason,
                    permanent: true,
                },
            });
        });
    }
}
exports.UserPurgeService = UserPurgeService;
