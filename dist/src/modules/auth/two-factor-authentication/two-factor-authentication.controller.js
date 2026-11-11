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
class TwoFactorAuthenticationController {
    constructor(tfaService) {
        this.tfaService = tfaService;
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
            var _a, _b;
            (0, request_credentials_1.assertCredentials)(req);
            const { jwt } = req.credentials;
            const user = yield req.credentials.user();
            const token = yield this.tfaService.verifyOtp({
                tokenId: jwt.tid,
                code: req.body.code,
                user,
                meta: {
                    ip: req.ip || null,
                    browser: ((_a = req.useragent) === null || _a === void 0 ? void 0 : _a.browser) || null,
                    os: ((_b = req.useragent) === null || _b === void 0 ? void 0 : _b.os) || null,
                },
                tfaCleared: jwt.tfa,
            });
            res.status(200).json({ token });
        }));
        this.enroll = (0, catch_async_1.default)((req, res) => __awaiter(this, void 0, void 0, function* () {
            (0, request_credentials_1.assertCredentials)(req);
            const { jwt } = req.credentials;
            const user = yield req.credentials.user();
            const result = yield this.tfaService.enrollTfa({
                userId: user.id,
                tokenId: jwt.tid,
                code: req.body.code,
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
            yield this.tfaService.disableTfa(user.id, req.body.password);
            res.status(200).json({
                disabled: true,
                message: "Two-factor authentication disabled successfully.",
            });
        }));
    }
}
exports.TwoFactorAuthenticationController = TwoFactorAuthenticationController;
