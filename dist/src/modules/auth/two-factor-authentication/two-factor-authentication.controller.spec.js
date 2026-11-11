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
const vitest_1 = require("vitest");
const two_factor_authentication_controller_1 = require("./two-factor-authentication.controller");
const errors_1 = require("../../../common/utils/errors");
const messages_1 = __importDefault(require("../../../common/utils/messages"));
(0, vitest_1.describe)("TwoFactorAuthenticationController Unit Tests", () => {
    let mockReq;
    let mockRes;
    let nextMock;
    let jsonMock;
    let statusMock;
    let tfaService;
    let controller;
    let auditService;
    const expectAppError = (error, expected) => {
        (0, vitest_1.expect)(error).toBeInstanceOf(errors_1.AppError);
        (0, vitest_1.expect)(error).toMatchObject(expected);
    };
    const expectNextAppError = (expected) => {
        (0, vitest_1.expect)(nextMock).toHaveBeenCalledOnce();
        const [error] = nextMock.mock.calls[0];
        expectAppError(error, expected);
    };
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.restoreAllMocks();
        tfaService = {
            sendOtp: vitest_1.vi.fn(),
            verifyOtp: vitest_1.vi.fn(),
        };
        auditService = {
            success: vitest_1.vi.fn(),
            failure: vitest_1.vi.fn(),
        };
        controller = new two_factor_authentication_controller_1.TwoFactorAuthenticationController(tfaService, auditService);
        jsonMock = vitest_1.vi.fn();
        statusMock = vitest_1.vi.fn().mockReturnValue({
            json: jsonMock,
        });
        nextMock = vitest_1.vi.fn();
        mockRes = {
            status: statusMock,
        };
        mockReq = {
            credentials: {
                jwt: {
                    uid: 1,
                    tid: 100,
                    tfa: false,
                    eml: "user@example.com",
                },
                user: vitest_1.vi.fn().mockResolvedValue({
                    id: 1,
                    email: "user@example.com",
                }),
                authentication: vitest_1.vi.fn().mockResolvedValue({
                    id: 100,
                    token: "mocked-auth-token",
                }),
            },
            body: {
                code: "123456",
            },
            /*
             * The controller reads the validated payload, never the
             * raw request body.
             */
            sanitize: {
                data: {
                    code: "123456",
                },
                body: {
                    only: vitest_1.vi.fn(),
                },
                query: {
                    get: vitest_1.vi.fn(),
                    numeric: vitest_1.vi.fn(),
                    only: vitest_1.vi.fn(),
                },
            },
            ip: "127.0.0.1",
            useragent: {
                browser: "Chrome",
                os: "Linux",
            },
        };
    });
    function executeController(method, req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const result = method(req, res, next);
                if (result && typeof result.then === "function") {
                    yield result;
                }
            }
            catch (error) {
                next(error);
            }
            yield new Promise((resolve) => setImmediate(resolve));
            yield new Promise(process.nextTick);
        });
    }
    (0, vitest_1.describe)("send() workflow tests", () => {
        (0, vitest_1.it)("should forward a 403 AppError if user session is already authenticated", () => __awaiter(void 0, void 0, void 0, function* () {
            mockReq.credentials.jwt.tfa = true;
            const serviceError = new errors_1.AppError(messages_1.default.OTP_NOT_NEEDED, "No OTP is necessary for this process");
            tfaService.sendOtp.mockRejectedValueOnce(serviceError);
            yield executeController(controller.send, mockReq, mockRes, nextMock);
            (0, vitest_1.expect)(tfaService.sendOtp).toHaveBeenCalledWith({
                tokenId: 100,
                email: "user@example.com",
                tfaCleared: true,
            });
            expectNextAppError({
                message: "No OTP is necessary for this process",
                errorCode: "OTP_NOT_NEEDED",
                statusCode: 400,
            });
            (0, vitest_1.expect)(statusMock).not.toHaveBeenCalled();
        }));
        (0, vitest_1.it)("should forward a 403 AppError if the JWT email is empty or missing", () => __awaiter(void 0, void 0, void 0, function* () {
            mockReq.credentials.jwt.eml = "   ";
            const serviceError = new errors_1.AppError(messages_1.default.UN_CONFIGURED_EMAIL, "There is an issue with your email configuration");
            tfaService.sendOtp.mockRejectedValueOnce(serviceError);
            yield executeController(controller.send, mockReq, mockRes, nextMock);
            (0, vitest_1.expect)(tfaService.sendOtp).toHaveBeenCalledWith({
                tokenId: 100,
                email: "user@example.com",
                tfaCleared: false,
            });
            expectNextAppError({
                message: "There is an issue with your email configuration",
                errorCode: "UN_CONFIGURED_EMAIL",
                statusCode: 500,
            });
            (0, vitest_1.expect)(statusMock).not.toHaveBeenCalled();
        }));
        (0, vitest_1.it)("should call sendOtp and respond with 200 on success", () => __awaiter(void 0, void 0, void 0, function* () {
            tfaService.sendOtp.mockResolvedValueOnce({
                id: 50,
                nextTry: "2026-07-19T22:00:00.000Z",
            });
            yield executeController(controller.send, mockReq, mockRes, nextMock);
            (0, vitest_1.expect)(tfaService.sendOtp).toHaveBeenCalledTimes(1);
            (0, vitest_1.expect)(tfaService.sendOtp).toHaveBeenCalledWith({
                tokenId: 100,
                email: "user@example.com",
                tfaCleared: false,
            });
            (0, vitest_1.expect)(statusMock).toHaveBeenCalledWith(200);
            (0, vitest_1.expect)(jsonMock).toHaveBeenCalledWith({
                id: 50,
                next_try: "2026-07-19T22:00:00.000Z",
            });
            (0, vitest_1.expect)(nextMock).not.toHaveBeenCalled();
        }));
        (0, vitest_1.it)("should forward email sender/service failures via next()", () => __awaiter(void 0, void 0, void 0, function* () {
            const serviceError = new errors_1.AppError(messages_1.default.UNABLE_TO_SEND_EMAIL, "There was an issue sending the email");
            tfaService.sendOtp.mockRejectedValueOnce(serviceError);
            yield executeController(controller.send, mockReq, mockRes, nextMock);
            (0, vitest_1.expect)(tfaService.sendOtp).toHaveBeenCalledWith({
                tokenId: 100,
                email: "user@example.com",
                tfaCleared: false,
            });
            (0, vitest_1.expect)(nextMock).toHaveBeenCalledWith(serviceError);
            (0, vitest_1.expect)(statusMock).not.toHaveBeenCalled();
        }));
        (0, vitest_1.it)("should forward internal service errors via next()", () => __awaiter(void 0, void 0, void 0, function* () {
            const serviceError = new errors_1.AppError(messages_1.default.TOO_MANY_ATTEMPTS, "Rate limit exceeded");
            tfaService.sendOtp.mockRejectedValueOnce(serviceError);
            yield executeController(controller.send, mockReq, mockRes, nextMock);
            (0, vitest_1.expect)(nextMock).toHaveBeenCalledWith(serviceError);
            (0, vitest_1.expect)(statusMock).not.toHaveBeenCalled();
        }));
    });
    (0, vitest_1.describe)("validate() verification tests", () => {
        (0, vitest_1.it)("should forward a 403 AppError if 2FA has already been cleared", () => __awaiter(void 0, void 0, void 0, function* () {
            mockReq.credentials.jwt.tfa = true;
            const serviceError = new errors_1.AppError(messages_1.default.OTP_NOT_NEEDED, "No OTP is necessary for this process");
            tfaService.verifyOtp.mockRejectedValueOnce(serviceError);
            yield executeController(controller.validate, mockReq, mockRes, nextMock);
            (0, vitest_1.expect)(tfaService.verifyOtp).toHaveBeenCalledWith({
                tokenId: 100,
                code: "123456",
                user: vitest_1.expect.any(Object),
                tfaCleared: true,
                meta: {
                    ip: "127.0.0.1",
                    browser: "Chrome",
                    os: "Linux",
                },
            });
            (0, vitest_1.expect)(nextMock).toHaveBeenCalledWith(serviceError);
            (0, vitest_1.expect)(statusMock).not.toHaveBeenCalled();
        }));
        (0, vitest_1.it)("should execute verifyOtp and respond with the renewed token on success", () => __awaiter(void 0, void 0, void 0, function* () {
            tfaService.verifyOtp.mockResolvedValueOnce("mocked-jwt-output-string");
            yield executeController(controller.validate, mockReq, mockRes, nextMock);
            (0, vitest_1.expect)(tfaService.verifyOtp).toHaveBeenCalledTimes(1);
            (0, vitest_1.expect)(tfaService.verifyOtp).toHaveBeenCalledWith({
                tokenId: 100,
                code: "123456",
                user: vitest_1.expect.any(Object),
                tfaCleared: false,
                meta: {
                    ip: "127.0.0.1",
                    browser: "Chrome",
                    os: "Linux",
                },
            });
            (0, vitest_1.expect)(statusMock).toHaveBeenCalledWith(200);
            (0, vitest_1.expect)(jsonMock).toHaveBeenCalledWith({
                token: "mocked-jwt-output-string",
            });
            (0, vitest_1.expect)(nextMock).not.toHaveBeenCalled();
        }));
        (0, vitest_1.it)("should forward verification failures via next()", () => __awaiter(void 0, void 0, void 0, function* () {
            const validationError = new errors_1.AppError(messages_1.default.INVALID_CODE, "Invalid verification code");
            tfaService.verifyOtp.mockRejectedValueOnce(validationError);
            yield executeController(controller.validate, mockReq, mockRes, nextMock);
            (0, vitest_1.expect)(tfaService.verifyOtp).toHaveBeenCalledWith({
                tokenId: 100,
                code: "123456",
                user: vitest_1.expect.any(Object),
                tfaCleared: false,
                meta: {
                    ip: "127.0.0.1",
                    browser: "Chrome",
                    os: "Linux",
                },
            });
            (0, vitest_1.expect)(nextMock).toHaveBeenCalledWith(validationError);
            (0, vitest_1.expect)(statusMock).not.toHaveBeenCalled();
            (0, vitest_1.expect)(jsonMock).not.toHaveBeenCalled();
        }));
    });
});
