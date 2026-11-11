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
exports.TwoFactorAuthenticationController = void 0;
const catch_async_1 = __importDefault(require("../../../common/utils/catch-async"));
const request_credentials_1 = require("../../../common/utils/request-credentials");
const request_info_1 = require("../../../common/utils/request-info");
const audit_interface_1 = require("../../audit/audit.interface");
class TwoFactorAuthenticationController {
    constructor(tfaService, auditService) {
        this.tfaService = tfaService;
        this.auditService = auditService;
        this.send = (0, catch_async_1.default)((req, res) => __awaiter(this, void 0, void 0, function* () {
            (0, request_credentials_1.assertCredentials)(req);
            const { jwt } = req.credentials;
            const user = yield req.credentials.user();
            const result = yield this.tfaService.sendOtp({
                tokenId: jwt.tid,
                email: user.email || undefined,
                tfaCleared: jwt.tfa,
            });
            res.status(200).json({
                id: result.id,
                next_try: result.nextTry,
            });
        }));
        this.validate = (0, catch_async_1.default)((req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d;
            (0, request_credentials_1.assertCredentials)(req);
            const { jwt } = req.credentials;
            const user = yield req.credentials.user();
            /*
             * The code comes from the validated payload, never straight
             * from the request body.
             */
            const { code } = req.sanitize.data;
            const token = yield this.tfaService.verifyOtp({
                tokenId: jwt.tid,
                code,
                user,
                meta: {
                    ip: (0, request_info_1.getClientIp)(req),
                    browser: (_b = (_a = req.useragent) === null || _a === void 0 ? void 0 : _a.browser) !== null && _b !== void 0 ? _b : null,
                    os: (_d = (_c = req.useragent) === null || _c === void 0 ? void 0 : _c.os) !== null && _d !== void 0 ? _d : null,
                },
                tfaCleared: jwt.tfa,
            });
            yield this.auditService.success(audit_interface_1.AUDIT_ACTIONS.AUTH_TFA_VERIFIED, {
                request: req,
            });
            res.status(200).json({ token });
        }));
        this.enroll = (0, catch_async_1.default)((req, res) => __awaiter(this, void 0, void 0, function* () {
            (0, request_credentials_1.assertCredentials)(req);
            const { jwt } = req.credentials;
            const user = yield req.credentials.user();
            const { code } = req.sanitize.data;
            const result = yield this.tfaService.enrollTfa({
                userId: user.id,
                tokenId: jwt.tid,
                code,
            });
            yield this.auditService.success(audit_interface_1.AUDIT_ACTIONS.AUTH_TFA_ENABLED, {
                request: req,
            });
            if (result.enrolled && result.recoveryCodes) {
                res.status(200).json({
                    enrolled: true,
                    message: "Two-factor authentication enabled successfully. Save your recovery codes.",
                    recovery_codes: result.recoveryCodes,
                });
            }
            else {
                res.status(200).json({ enrolled: false });
            }
        }));
        this.disable = (0, catch_async_1.default)((req, res) => __awaiter(this, void 0, void 0, function* () {
            (0, request_credentials_1.assertCredentials)(req);
            const user = yield req.credentials.user();
            const { password } = req.sanitize.data;
            yield this.tfaService.disableTfa(user.id, password);
            yield this.auditService.success(audit_interface_1.AUDIT_ACTIONS.AUTH_TFA_DISABLED, {
                request: req,
            });
            res.status(200).json({
                disabled: true,
                message: "Two-factor authentication disabled successfully.",
            });
        }));
    }
}
exports.TwoFactorAuthenticationController = TwoFactorAuthenticationController;
