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
exports.AuthenticationMiddleware = AuthenticationMiddleware;
const errors_1 = require("../utils/errors");
// 🧠 IMPORT from your isolated container instead of hardcoding instantiations here!
const container_1 = require("../../config/container");
const messages_1 = __importDefault(require("../utils/messages"));
function AuthenticationMiddleware(isHalt = true) {
    return function (req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Extract and validate authorization header structure
                const authHeader = req.headers.authorization;
                if (!authHeader || !authHeader.startsWith("Bearer ")) {
                    if (isHalt) {
                        return next(new errors_1.AppError(messages_1.default.UNAUTHORIZED, "Authorization token missing or malformed"));
                    }
                    return next(); // Keeps req.credentials clean/undefined instead of crashing on null
                }
                const token = authHeader.split(" ")[1];
                // Decode and parse token signature
                let payload;
                try {
                    payload = container_1.tokenService.verifyToken(token);
                }
                catch (error) {
                    if (isHalt) {
                        return next(new errors_1.AppError(messages_1.default.UNAUTHORIZED, "Invalid or expired authentication token"));
                    }
                    return next();
                }
                // Bind dynamic lazy promises checking fully structured DB returns
                req.credentials = {
                    jwt: payload,
                    user: () => __awaiter(this, void 0, void 0, function* () {
                        return yield container_1.userService.findAuthById(payload.uid);
                    }),
                    authentication: () => __awaiter(this, void 0, void 0, function* () {
                        return yield container_1.authService.findAuthenticationToken(payload);
                    })
                };
                // Enforce server-side session existence for revocable tokens.
                // All tokens must have a valid tid > 0 and corresponding session.
                if (!payload.tid || payload.tid <= 0) {
                    if (isHalt) {
                        return next(new errors_1.AppError(messages_1.default.UNAUTHORIZED, "Invalid session token"));
                    }
                    return next();
                }
                yield req.credentials.authentication();
                return next();
            }
            catch (err) {
                return next(err);
            }
        });
    };
}
