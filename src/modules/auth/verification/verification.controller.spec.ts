// src/modules/auth/verification/verification.controller.spec.ts
import {beforeEach, describe, expect, it, vi} from "vitest";
import {NextFunction, Request, Response} from "express";

import {VerificationController} from "./verification.controller";
import {VerificationService} from "./verification.service";
import Messages from "../../../common/utils/messages";

const {mockSend, mockConfirm} = vi.hoisted(() => ({
    mockSend: vi.fn(),
    mockConfirm: vi.fn(),
}));

vi.mock("../../../common/utils/catch-async", () => ({
    default: (fn: any) => (req: any, res: any, next: any) =>
        Promise.resolve(fn(req, res, next)).catch(next),
}));

describe("VerificationController", () => {
    let controller: VerificationController;
    let req: Partial<Request> & {sanitize?: any; credentials?: any};
    let res: Partial<Response>;
    let next: NextFunction;

    const expiresAt = new Date("2026-01-01T00:00:00.000Z");

    type ControllerMethod =
        | "sendEmail"
        | "confirmEmail"
        | "sendPhone"
        | "confirmPhone";

    const invoke = async (method: ControllerMethod) => {
        await controller[method](
            req as Request,
            res as Response,
            next,
        );
    };

    const expectSuccessfulResponse = (data: unknown) => {
        expect(res.status).toHaveBeenCalledTimes(1);
        expect(res.status).toHaveBeenCalledWith(200);

        expect(res.json).toHaveBeenCalledTimes(1);
        expect(res.json).toHaveBeenCalledWith(data);

        expect(next).not.toHaveBeenCalled();
    };

    const expectErrorForwarded = (error: unknown) => {
        expect(next).toHaveBeenCalledTimes(1);
        expect(next).toHaveBeenCalledWith(error);

        expect(res.status).not.toHaveBeenCalled();
        expect(res.json).not.toHaveBeenCalled();
    };

    const expectAuthenticationError = () => {
        expectErrorForwarded(
            expect.objectContaining({
                message: Messages.INVALID_AUTH_TOKEN.message,
                errorCode: Messages.INVALID_AUTH_TOKEN.code,
                statusCode: Messages.INVALID_AUTH_TOKEN.status,
            }),
        );
    };

    beforeEach(() => {
        vi.clearAllMocks();

        controller = new VerificationController({
            send: mockSend,
            confirm: mockConfirm,
        } as unknown as VerificationService);

        req = {
            credentials: {
                jwt: {
                    tid: 45,
                    uid: 1,
                    tfa: false,
                },
                user: vi.fn(),
                authentication: vi.fn(),
            },
            sanitize: {
                body: {},
                query: {},
                data: {},
            },
        } as any;

        res = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn().mockReturnThis(),
        };

        next = vi.fn();
    });

    describe("sendEmail()", () => {
        it("should send an email verification code for the authenticated user", async () => {
            req.sanitize!.data = {email: "john@example.com"};
            mockSend.mockResolvedValue({sent: true, expiresAt});

            await invoke("sendEmail");

            expect(mockSend).toHaveBeenCalledTimes(1);
            expect(mockSend).toHaveBeenCalledWith(
                1,
                "email",
                "john@example.com",
            );

            expectSuccessfulResponse({
                sent: true,
                expires_at: expiresAt,
            });
        });

        it("should forward credentials errors", async () => {
            delete req.credentials;
            req.sanitize!.data = {email: "john@example.com"};

            await invoke("sendEmail");

            expect(mockSend).not.toHaveBeenCalled();
            expectAuthenticationError();
        });

        it("should forward service errors", async () => {
            const serviceError = new Error("Failed to send verification");

            req.sanitize!.data = {email: "john@example.com"};
            mockSend.mockRejectedValue(serviceError);

            await invoke("sendEmail");

            expect(mockSend).toHaveBeenCalledTimes(1);
            expectErrorForwarded(serviceError);
        });

        it("should forward an error when the sanitize context is missing", async () => {
            delete req.sanitize;

            await invoke("sendEmail");

            expect(mockSend).not.toHaveBeenCalled();
            expectErrorForwarded(expect.any(TypeError));
        });
    });

    describe("confirmEmail()", () => {
        it("should confirm an email verification code for the authenticated user", async () => {
            req.sanitize!.data = {code: "email-token"};
            mockConfirm.mockResolvedValue({
                verified: true,
                channel: "email",
            });

            await invoke("confirmEmail");

            expect(mockConfirm).toHaveBeenCalledTimes(1);
            expect(mockConfirm).toHaveBeenCalledWith(1, "email-token");

            expectSuccessfulResponse({
                verified: true,
                channel: "email",
            });
        });

        it("should forward service errors", async () => {
            const serviceError = new Error("Invalid verification code");

            req.sanitize!.data = {code: "bad-token"};
            mockConfirm.mockRejectedValue(serviceError);

            await invoke("confirmEmail");

            expect(mockConfirm).toHaveBeenCalledTimes(1);
            expectErrorForwarded(serviceError);
        });

        it("should forward credentials errors", async () => {
            delete req.credentials;
            req.sanitize!.data = {code: "email-token"};

            await invoke("confirmEmail");

            expect(mockConfirm).not.toHaveBeenCalled();
            expectAuthenticationError();
        });
    });

    describe("sendPhone()", () => {
        it("should send a phone verification code for the authenticated user", async () => {
            req.sanitize!.data = {phone: "+1234567890"};
            mockSend.mockResolvedValue({sent: true, expiresAt});

            await invoke("sendPhone");

            expect(mockSend).toHaveBeenCalledTimes(1);
            expect(mockSend).toHaveBeenCalledWith(
                1,
                "phone",
                "+1234567890",
            );

            expectSuccessfulResponse({
                sent: true,
                expires_at: expiresAt,
            });
        });

        it("should reject a request without a phone number", async () => {
            req.sanitize!.data = {phone: ""};

            await invoke("sendPhone");

            expect(mockSend).not.toHaveBeenCalled();

            expectErrorForwarded(
                expect.objectContaining({
                    message: Messages.INVALID_REQUEST.message,
                    errorCode: Messages.INVALID_REQUEST.code,
                    statusCode: Messages.INVALID_REQUEST.status,
                }),
            );
        });

        it("should forward credentials errors", async () => {
            delete req.credentials;
            req.sanitize!.data = {phone: "+1234567890"};

            await invoke("sendPhone");

            expect(mockSend).not.toHaveBeenCalled();
            expectAuthenticationError();
        });

        it("should forward service errors", async () => {
            const serviceError = new Error("Failed to send phone code");

            req.sanitize!.data = {phone: "+1234567890"};
            mockSend.mockRejectedValue(serviceError);

            await invoke("sendPhone");

            expect(mockSend).toHaveBeenCalledTimes(1);
            expectErrorForwarded(serviceError);
        });
    });

    describe("confirmPhone()", () => {
        it("should confirm a phone verification code for the authenticated user", async () => {
            req.sanitize!.data = {code: "phone-token"};
            mockConfirm.mockResolvedValue({
                verified: true,
                channel: "phone",
            });

            await invoke("confirmPhone");

            expect(mockConfirm).toHaveBeenCalledTimes(1);
            expect(mockConfirm).toHaveBeenCalledWith(1, "phone-token");

            expectSuccessfulResponse({
                verified: true,
                channel: "phone",
            });
        });

        it("should forward service errors", async () => {
            const serviceError = new Error("Invalid verification code");

            req.sanitize!.data = {code: "bad-token"};
            mockConfirm.mockRejectedValue(serviceError);

            await invoke("confirmPhone");

            expect(mockConfirm).toHaveBeenCalledTimes(1);
            expectErrorForwarded(serviceError);
        });

        it("should forward credentials errors", async () => {
            delete req.credentials;
            req.sanitize!.data = {code: "phone-token"};

            await invoke("confirmPhone");

            expect(mockConfirm).not.toHaveBeenCalled();
            expectAuthenticationError();
        });
    });
});
