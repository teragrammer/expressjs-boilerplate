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
exports.TwoFactorAuthenticationMiddleware = TwoFactorAuthenticationMiddleware;
const messages_1 = __importDefault(require("../utils/messages"));
const request_credentials_1 = require("../utils/request-credentials");
function TwoFactorAuthenticationMiddleware(isHalt = true) {
    return function (req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!req.credentials) {
                if (isHalt) {
                    res.status(401).json({
                        code: "AUTH_OTP_EXPIRED",
                        message: messages_1.default.EXPIRED_AUTH_TOKEN.message,
                    });
                    return;
                }
                next();
                return;
            }
            (0, request_credentials_1.assertCredentials)(req);
            if (!req.credentials.jwt.tfa) {
                res.status(403).json({
                    code: "AUTH_OTP_INCOMPLETE",
                    message: messages_1.default.INCOMPLETE_OTP.message,
                });
                return;
            }
            next();
        });
    };
}
