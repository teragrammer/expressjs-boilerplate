import {beforeEach, describe, expect, it, vi} from "vitest";
import {Response} from "express";
import {TwoFactorAuthenticationController,} from "./two-factor-authentication.controller";
import {AppError} from "../../../common/utils/errors";
import {TwoFactorAuthenticationService} from "../services/two-factor-authentication.service";
import Messages from "../../../common/utils/messages";

describe("TwoFactorAuthenticationController Unit Tests", () => {
    let mockReq: any;
    let mockRes: Partial<Response>;
    let nextMock: ReturnType<typeof vi.fn>;
    let jsonMock: ReturnType<typeof vi.fn>;
    let statusMock: Response["status"];

    let tfaService: {
        sendOtp: ReturnType<typeof vi.fn>;
        verifyOtp: ReturnType<typeof vi.fn>;
    };

    let controller: TwoFactorAuthenticationController;

    const expectAppError = (
        error: unknown,
        expected: {
            message: string;
            errorCode: string;
            statusCode: number;
        },
    ): void => {
        expect(error).toBeInstanceOf(AppError);
        expect(error).toMatchObject(expected);
    };

    const expectNextAppError = (
        expected: {
            message: string;
            errorCode: string;
            statusCode: number;
        },
    ): void => {
        expect(nextMock).toHaveBeenCalledOnce();

        const [error] = nextMock.mock.calls[0];

        expectAppError(error, expected);
    };

    beforeEach(() => {
        vi.restoreAllMocks();

        tfaService = {
            sendOtp: vi.fn(),
            verifyOtp: vi.fn(),
        };

        controller = new TwoFactorAuthenticationController(
            tfaService as unknown as TwoFactorAuthenticationService,
        );

        jsonMock = vi.fn();

        statusMock = vi.fn().mockReturnValue({
            json: jsonMock,
        }) as unknown as Response["status"];

        nextMock = vi.fn();

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

                user: vi.fn().mockResolvedValue({
                    id: 1,
                    email: "user@example.com",
                }),

                authentication: vi.fn().mockResolvedValue({
                    id: 100,
                    token: "mocked-auth-token",
                }),
            },

            body: {
                code: "123456",
            },

            ip: "127.0.0.1",

            useragent: {
                browser: "Chrome",
                os: "Linux",
            },
        };
    });

    async function executeController(
        method: Function,
        req: any,
        res: any,
        next: any,
    ): Promise<void> {
        try {
            const result = method(req, res, next);

            if (result && typeof result.then === "function") {
                await result;
            }
        } catch (error) {
            next(error);
        }

        await new Promise((resolve) => setImmediate(resolve));
        await new Promise(process.nextTick);
    }

    describe("send() workflow tests", () => {
        it(
            "should forward a 403 AppError if user session is already authenticated",
            async () => {
                mockReq.credentials.jwt.tfa = true;

                const serviceError = new AppError(
                    Messages.OTP_NOT_NEEDED,
                    "No OTP is necessary for this process",
                );

                tfaService.sendOtp.mockRejectedValueOnce(serviceError);

                await executeController(
                    controller.send,
                    mockReq,
                    mockRes,
                    nextMock,
                );

                expect(tfaService.sendOtp).toHaveBeenCalledWith({
                    tokenId: 100,
                    email: "user@example.com",
                    tfaCleared: true,
                });

                expectNextAppError({
                    message: "No OTP is necessary for this process",
                    errorCode: "OTP_NOT_NEEDED",
                    statusCode: 400,
                });

                expect(statusMock).not.toHaveBeenCalled();
            },
        );

        it(
            "should forward a 403 AppError if the JWT email is empty or missing",
            async () => {
                mockReq.credentials.jwt.eml = "   ";

                const serviceError = new AppError(
                    Messages.UN_CONFIGURED_EMAIL,
                    "There is an issue with your email configuration",
                );

                tfaService.sendOtp.mockRejectedValueOnce(serviceError);

                await executeController(
                    controller.send,
                    mockReq,
                    mockRes,
                    nextMock,
                );

                expect(tfaService.sendOtp).toHaveBeenCalledWith({
                    tokenId: 100,
                    email: "user@example.com",
                    tfaCleared: false,
                });

                expectNextAppError({
                    message: "There is an issue with your email configuration",
                    errorCode: "UN_CONFIGURED_EMAIL",
                    statusCode: 500,
                });

                expect(statusMock).not.toHaveBeenCalled();
            },
        );

        it(
            "should call sendOtp and respond with 200 on success",
            async () => {
                tfaService.sendOtp.mockResolvedValueOnce({
                    id: 50,
                    nextTry: "2026-07-19T22:00:00.000Z",
                });

                await executeController(
                    controller.send,
                    mockReq,
                    mockRes,
                    nextMock,
                );

                expect(tfaService.sendOtp).toHaveBeenCalledTimes(1);

                expect(tfaService.sendOtp).toHaveBeenCalledWith({
                    tokenId: 100,
                    email: "user@example.com",
                    tfaCleared: false,
                });

                expect(statusMock).toHaveBeenCalledWith(200);

                expect(jsonMock).toHaveBeenCalledWith({
                    id: 50,
                    next_try: "2026-07-19T22:00:00.000Z",
                });

                expect(nextMock).not.toHaveBeenCalled();
            },
        );

        it(
            "should forward email sender/service failures via next()",
            async () => {
                const serviceError = new AppError(
                    Messages.UNABLE_TO_SEND_EMAIL,
                    "There was an issue sending the email",
                );

                tfaService.sendOtp.mockRejectedValueOnce(serviceError);

                await executeController(
                    controller.send,
                    mockReq,
                    mockRes,
                    nextMock,
                );

                expect(tfaService.sendOtp).toHaveBeenCalledWith({
                    tokenId: 100,
                    email: "user@example.com",
                    tfaCleared: false,
                });

                expect(nextMock).toHaveBeenCalledWith(serviceError);
                expect(statusMock).not.toHaveBeenCalled();
            },
        );

        it(
            "should forward internal service errors via next()",
            async () => {
                const serviceError = new AppError(
                    Messages.TOO_MANY_ATTEMPTS,
                    "Rate limit exceeded",
                );

                tfaService.sendOtp.mockRejectedValueOnce(serviceError);

                await executeController(
                    controller.send,
                    mockReq,
                    mockRes,
                    nextMock,
                );

                expect(nextMock).toHaveBeenCalledWith(serviceError);
                expect(statusMock).not.toHaveBeenCalled();
            },
        );
    });

    describe("validate() verification tests", () => {
        it(
            "should forward a 403 AppError if 2FA has already been cleared",
            async () => {
                mockReq.credentials.jwt.tfa = true;

                const serviceError = new AppError(
                    Messages.OTP_NOT_NEEDED,
                    "No OTP is necessary for this process",
                );

                tfaService.verifyOtp.mockRejectedValueOnce(serviceError);

                await executeController(
                    controller.validate,
                    mockReq,
                    mockRes,
                    nextMock,
                );

                expect(tfaService.verifyOtp).toHaveBeenCalledWith({
                    tokenId: 100,
                    code: "123456",
                    user: expect.any(Object),
                    tfaCleared: true,
                    meta: {
                        ip: "127.0.0.1",
                        browser: "Chrome",
                        os: "Linux",
                    },
                });

                expect(nextMock).toHaveBeenCalledWith(serviceError);
                expect(statusMock).not.toHaveBeenCalled();
            },
        );

        it(
            "should execute verifyOtp and respond with the renewed token on success",
            async () => {
                tfaService.verifyOtp.mockResolvedValueOnce(
                    "mocked-jwt-output-string",
                );

                await executeController(
                    controller.validate,
                    mockReq,
                    mockRes,
                    nextMock,
                );

                expect(tfaService.verifyOtp).toHaveBeenCalledTimes(1);

                expect(tfaService.verifyOtp).toHaveBeenCalledWith({
                    tokenId: 100,
                    code: "123456",
                    user: expect.any(Object),
                    tfaCleared: false,
                    meta: {
                        ip: "127.0.0.1",
                        browser: "Chrome",
                        os: "Linux",
                    },
                });

                expect(statusMock).toHaveBeenCalledWith(200);

                expect(jsonMock).toHaveBeenCalledWith({
                    token: "mocked-jwt-output-string",
                });

                expect(nextMock).not.toHaveBeenCalled();
            },
        );

        it(
            "should forward verification failures via next()",
            async () => {
                const validationError = new AppError(
                    Messages.INVALID_CODE,
                    "Invalid verification code",
                );

                tfaService.verifyOtp.mockRejectedValueOnce(
                    validationError,
                );

                await executeController(
                    controller.validate,
                    mockReq,
                    mockRes,
                    nextMock,
                );

                expect(tfaService.verifyOtp).toHaveBeenCalledWith({
                    tokenId: 100,
                    code: "123456",
                    user: expect.any(Object),
                    tfaCleared: false,
                    meta: {
                        ip: "127.0.0.1",
                        browser: "Chrome",
                        os: "Linux",
                    },
                });

                expect(nextMock).toHaveBeenCalledWith(
                    validationError,
                );

                expect(statusMock).not.toHaveBeenCalled();
                expect(jsonMock).not.toHaveBeenCalled();
            },
        );
    });
});
