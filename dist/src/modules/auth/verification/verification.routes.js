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
// src/modules/auth/verification/verification.routes.ts
const express_1 = require("express");
const catch_async_1 = __importDefault(require("../../../common/utils/catch-async"));
const authentication_middleware_1 = require("../../../common/middleware/authentication.middleware");
const validate_middleware_1 = require("../../../common/middleware/validate.middleware");
const rate_limiter_middleware_1 = require("../../../common/middleware/rate-limiter.middleware");
const request_credentials_1 = require("../../../common/utils/request-credentials");
const errors_1 = require("../../../common/utils/errors");
const messages_1 = __importDefault(require("../../../common/utils/messages"));
const container_1 = require("../../../config/container");
const verification_schema_1 = require("./verification.schema");
exports.default = () => {
    const router = (0, express_1.Router)();
    /**
     * Requests a verification code for the caller's email.
     *
     * The response is identical whether or not the address is already
     * registered, so the endpoint cannot be used to enumerate accounts.
     */
    router.post("/email/verification/send", [
        rate_limiter_middleware_1.authRateLimiters.verificationSend,
        (0, authentication_middleware_1.AuthenticationMiddleware)(),
        (0, validate_middleware_1.validate)(verification_schema_1.sendVerificationSchema, ["email"]),
    ], (0, catch_async_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
        (0, request_credentials_1.assertCredentials)(req);
        const { email } = req.sanitize.data;
        const result = yield container_1.verificationService.send(req.credentials.jwt.uid, "email", email);
        res.status(200).json({
            sent: true,
            expires_at: result.expiresAt,
        });
    })));
    /**
     * Confirms an email verification code.
     */
    router.post("/email/verification/confirm", [
        rate_limiter_middleware_1.authRateLimiters.verificationConfirm,
        (0, authentication_middleware_1.AuthenticationMiddleware)(),
        (0, validate_middleware_1.validate)(verification_schema_1.sendVerificationSchema, ["code"]),
    ], (0, catch_async_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
        (0, request_credentials_1.assertCredentials)(req);
        const { code } = req.sanitize.data;
        const result = yield container_1.verificationService.confirm(req.credentials.jwt.uid, code);
        res.status(200).json({
            verified: result.verified,
            channel: result.channel,
        });
    })));
    /**
     * Requests a verification code for the caller's phone.
     */
    router.post("/phone/verification/send", [
        rate_limiter_middleware_1.authRateLimiters.verificationSend,
        (0, authentication_middleware_1.AuthenticationMiddleware)(),
        (0, validate_middleware_1.validate)(verification_schema_1.sendVerificationSchema, ["phone"]),
    ], (0, catch_async_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
        (0, request_credentials_1.assertCredentials)(req);
        const { phone } = req.sanitize.data;
        if (!phone) {
            throw new errors_1.AppError(messages_1.default.INVALID_REQUEST);
        }
        const result = yield container_1.verificationService.send(req.credentials.jwt.uid, "phone", phone);
        res.status(200).json({
            sent: true,
            expires_at: result.expiresAt,
        });
    })));
    /**
     * Confirms a phone verification code.
     */
    router.post("/phone/verification/confirm", [
        rate_limiter_middleware_1.authRateLimiters.verificationConfirm,
        (0, authentication_middleware_1.AuthenticationMiddleware)(),
        (0, validate_middleware_1.validate)(verification_schema_1.sendVerificationSchema, ["code"]),
    ], (0, catch_async_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
        (0, request_credentials_1.assertCredentials)(req);
        const { code } = req.sanitize.data;
        const result = yield container_1.verificationService.confirm(req.credentials.jwt.uid, code);
        res.status(200).json({
            verified: result.verified,
            channel: result.channel,
        });
    })));
    return router;
};
