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
exports.AuthorizationMiddleware = AuthorizationMiddleware;
const messages_1 = __importDefault(require("../utils/messages"));
const container_1 = require("../../config/container");
function AuthorizationMiddleware(route, isHalt = true) {
    return function (req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            const credentials = req.credentials;
            if (!credentials && isHalt) {
                return res.status(401).json({
                    code: "AUTH_PERM_EXPIRED",
                    message: messages_1.default.EXPIRED_AUTH_TOKEN.message,
                });
            }
            if (credentials && isHalt) {
                const byPass = credentials.jwt.bpa;
                if (byPass === 1) {
                    return next();
                }
                const guards = yield container_1.routeGuardService.getCache();
                const role = credentials.jwt.rol;
                if (!guards || !role) {
                    return res.status(403).json({
                        code: "AUTH_PERM_CACHE",
                        message: messages_1.default.NO_PERMISSION.message,
                    });
                }
                if (typeof guards[role] === "undefined") {
                    return res.status(403).json({
                        code: "AUTH_PERM_UNDEFINED",
                        message: messages_1.default.NO_PERMISSION.message,
                    });
                }
                if (!guards[role].includes(route)) {
                    return res.status(403).json({
                        code: "AUTH_PERM_UNAUTHORIZED",
                        message: messages_1.default.NO_PERMISSION.message,
                    });
                }
            }
            next();
        });
    };
}
