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
// src/modules/audit/audit.routes.ts
const express_1 = require("express");
const catch_async_1 = __importDefault(require("../../common/utils/catch-async"));
const authentication_middleware_1 = require("../../common/middleware/authentication.middleware");
const authorization_middleware_1 = require("../../common/middleware/authorization.middleware");
const errors_1 = require("../../common/utils/errors");
const messages_1 = __importDefault(require("../../common/utils/messages"));
const container_1 = require("../../config/container");
exports.default = () => {
    const router = (0, express_1.Router)();
    /**
     * Reads audit events.
     *
     * Restricted to the `audit:view` route guard. Auditors and admins
     * use this endpoint to trace a request id or an actor.
     */
    router.get("/", [
        (0, authentication_middleware_1.AuthenticationMiddleware)(),
        (0, authorization_middleware_1.AuthorizationMiddleware)("audit:view"),
    ], (0, catch_async_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const page = Math.max(1, Number(req.query.page) || 1);
        const perPage = Math.min(100, Math.max(1, Number(req.query.per_page) || 20));
        const actorUserId = req.query.actor_user_id
            ? Number(req.query.actor_user_id)
            : undefined;
        if (actorUserId !== undefined &&
            !Number.isSafeInteger(actorUserId)) {
            throw new errors_1.AppError(messages_1.default.INVALID_PATH_PARAM);
        }
        const action = req.query.action
            ? String(req.query.action)
            : undefined;
        const outcome = req.query.outcome
            ? String(req.query.outcome)
            : undefined;
        const result = yield container_1.auditService.browse({
            actorUserId,
            action,
            outcome,
            page,
            perPage,
        });
        res.status(200).json({
            items: result.items,
            total: result.total,
            page,
            per_page: perPage,
        });
    })));
    return router;
};
