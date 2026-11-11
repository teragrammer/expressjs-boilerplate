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
const mail_1 = __importDefault(require("@sendgrid/mail"));
const sendgrid_mail_service_1 = require("./sendgrid-mail.service");
const logger_1 = require("../../config/logger");
const errors_1 = require("../../common/utils/errors");
const messages_1 = __importDefault(require("../../common/utils/messages"));
vitest_1.vi.mock("@sendgrid/mail", () => ({
    default: {
        setApiKey: vitest_1.vi.fn(),
        send: vitest_1.vi.fn(),
    },
}));
vitest_1.vi.mock("../../config/logger", () => ({
    logger: {
        error: vitest_1.vi.fn(),
    },
}));
(0, vitest_1.describe)("SendGridMailService", () => {
    let service;
    const mockSetApiKey = vitest_1.vi.mocked(mail_1.default.setApiKey);
    const mockSend = vitest_1.vi.mocked(mail_1.default.send);
    const mockLoggerError = vitest_1.vi.mocked(logger_1.logger.error);
    const baseInput = {
        to: "recipient@example.com",
        from: "sender@example.com",
        subject: "Test email",
        text: "Hello from the test",
    };
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.clearAllMocks();
        service = new sendgrid_mail_service_1.SendGridMailService("test-api-key");
    });
    (0, vitest_1.describe)("constructor", () => {
        (0, vitest_1.it)("should configure SendGrid with the provided API key", () => {
            (0, vitest_1.expect)(mockSetApiKey).toHaveBeenCalledTimes(1);
            (0, vitest_1.expect)(mockSetApiKey).toHaveBeenCalledWith("test-api-key");
        });
    });
    (0, vitest_1.describe)("send", () => {
        (0, vitest_1.it)("should send an email successfully", () => __awaiter(void 0, void 0, void 0, function* () {
            mockSend.mockResolvedValueOnce([]);
            yield (0, vitest_1.expect)(service.send(baseInput)).resolves.toBeUndefined();
            (0, vitest_1.expect)(mockSend).toHaveBeenCalledTimes(1);
            (0, vitest_1.expect)(mockSend).toHaveBeenCalledWith({
                to: "recipient@example.com",
                from: "sender@example.com",
                subject: "Test email",
                text: "Hello from the test",
            });
            (0, vitest_1.expect)(mockLoggerError).not.toHaveBeenCalled();
        }));
        (0, vitest_1.it)("should support multiple recipients", () => __awaiter(void 0, void 0, void 0, function* () {
            mockSend.mockResolvedValueOnce([]);
            const input = Object.assign(Object.assign({}, baseInput), { to: [
                    "first@example.com",
                    "second@example.com",
                ] });
            yield (0, vitest_1.expect)(service.send(input)).resolves.toBeUndefined();
            (0, vitest_1.expect)(mockSend).toHaveBeenCalledWith({
                to: [
                    "first@example.com",
                    "second@example.com",
                ],
                from: "sender@example.com",
                subject: "Test email",
                text: "Hello from the test",
            });
        }));
        (0, vitest_1.it)("should include html when html is provided", () => __awaiter(void 0, void 0, void 0, function* () {
            mockSend.mockResolvedValueOnce([]);
            const input = Object.assign(Object.assign({}, baseInput), { html: "<h1>Hello</h1>" });
            yield (0, vitest_1.expect)(service.send(input)).resolves.toBeUndefined();
            (0, vitest_1.expect)(mockSend).toHaveBeenCalledWith({
                to: "recipient@example.com",
                from: "sender@example.com",
                subject: "Test email",
                text: "Hello from the test",
                html: "<h1>Hello</h1>",
            });
        }));
        (0, vitest_1.it)("should omit html when html is undefined", () => __awaiter(void 0, void 0, void 0, function* () {
            mockSend.mockResolvedValueOnce([]);
            const input = Object.assign(Object.assign({}, baseInput), { html: undefined });
            yield service.send(input);
            (0, vitest_1.expect)(mockSend).toHaveBeenCalledWith({
                to: "recipient@example.com",
                from: "sender@example.com",
                subject: "Test email",
                text: "Hello from the test",
            });
        }));
        (0, vitest_1.it)("should use an empty string when text is undefined", () => __awaiter(void 0, void 0, void 0, function* () {
            mockSend.mockResolvedValueOnce([]);
            const input = {
                to: "recipient@example.com",
                from: "sender@example.com",
                subject: "Test email",
            };
            yield (0, vitest_1.expect)(service.send(input)).resolves.toBeUndefined();
            (0, vitest_1.expect)(mockSend).toHaveBeenCalledWith({
                to: "recipient@example.com",
                from: "sender@example.com",
                subject: "Test email",
                text: "",
            });
        }));
        (0, vitest_1.it)("should preserve an explicitly provided empty text value", () => __awaiter(void 0, void 0, void 0, function* () {
            mockSend.mockResolvedValueOnce([]);
            const input = Object.assign(Object.assign({}, baseInput), { text: "" });
            yield service.send(input);
            (0, vitest_1.expect)(mockSend).toHaveBeenCalledWith({
                to: "recipient@example.com",
                from: "sender@example.com",
                subject: "Test email",
                text: "",
            });
        }));
        (0, vitest_1.it)("should preserve an explicitly provided empty html value", () => __awaiter(void 0, void 0, void 0, function* () {
            mockSend.mockResolvedValueOnce([]);
            const input = Object.assign(Object.assign({}, baseInput), { html: "" });
            yield service.send(input);
            (0, vitest_1.expect)(mockSend).toHaveBeenCalledWith({
                to: "recipient@example.com",
                from: "sender@example.com",
                subject: "Test email",
                text: "Hello from the test",
                html: "",
            });
        }));
        (0, vitest_1.describe)("when SendGrid throws an Error", () => {
            (0, vitest_1.it)("should log the original error message", () => __awaiter(void 0, void 0, void 0, function* () {
                const error = new Error("SendGrid request failed");
                mockSend.mockRejectedValueOnce(error);
                yield (0, vitest_1.expect)(service.send(baseInput)).rejects.toBeInstanceOf(errors_1.AppError);
                (0, vitest_1.expect)(mockLoggerError).toHaveBeenCalledTimes(1);
                (0, vitest_1.expect)(mockLoggerError).toHaveBeenCalledWith({
                    error: "SendGrid request failed",
                }, "Failed to send email");
            }));
            (0, vitest_1.it)("should throw an AppError with the expected error metadata", () => __awaiter(void 0, void 0, void 0, function* () {
                mockSend.mockRejectedValueOnce(new Error("SendGrid request failed"));
                yield (0, vitest_1.expect)(service.send(baseInput)).rejects.toMatchObject({
                    message: messages_1.default.UNABLE_TO_SEND_EMAIL.message,
                    errorCode: messages_1.default.UNABLE_TO_SEND_EMAIL.code,
                    statusCode: messages_1.default.UNABLE_TO_SEND_EMAIL.status,
                });
            }));
            (0, vitest_1.it)("should not rethrow the original error", () => __awaiter(void 0, void 0, void 0, function* () {
                const originalError = new Error("SendGrid request failed");
                mockSend.mockRejectedValueOnce(originalError);
                try {
                    yield service.send(baseInput);
                    throw new Error("Expected service.send() to reject");
                }
                catch (error) {
                    (0, vitest_1.expect)(error).toBeInstanceOf(errors_1.AppError);
                    (0, vitest_1.expect)(error).not.toBe(originalError);
                }
            }));
        });
        (0, vitest_1.describe)("when SendGrid rejects with a non-Error value", () => {
            (0, vitest_1.it)("should use the unknown email delivery error message", () => __awaiter(void 0, void 0, void 0, function* () {
                mockSend.mockRejectedValueOnce("SendGrid failed");
                yield (0, vitest_1.expect)(service.send(baseInput)).rejects.toBeInstanceOf(errors_1.AppError);
                (0, vitest_1.expect)(mockLoggerError).toHaveBeenCalledTimes(1);
                (0, vitest_1.expect)(mockLoggerError).toHaveBeenCalledWith({
                    error: "Unknown email delivery error",
                }, "Failed to send email");
            }));
            (0, vitest_1.it)("should handle null as the rejection value", () => __awaiter(void 0, void 0, void 0, function* () {
                mockSend.mockRejectedValueOnce(null);
                yield (0, vitest_1.expect)(service.send(baseInput)).rejects.toBeInstanceOf(errors_1.AppError);
                (0, vitest_1.expect)(mockLoggerError).toHaveBeenCalledWith({
                    error: "Unknown email delivery error",
                }, "Failed to send email");
            }));
            (0, vitest_1.it)("should handle undefined as the rejection value", () => __awaiter(void 0, void 0, void 0, function* () {
                mockSend.mockRejectedValueOnce(undefined);
                yield (0, vitest_1.expect)(service.send(baseInput)).rejects.toBeInstanceOf(errors_1.AppError);
                (0, vitest_1.expect)(mockLoggerError).toHaveBeenCalledWith({
                    error: "Unknown email delivery error",
                }, "Failed to send email");
            }));
        });
        (0, vitest_1.it)("should not log an error when sending succeeds", () => __awaiter(void 0, void 0, void 0, function* () {
            mockSend.mockResolvedValueOnce([]);
            yield service.send(baseInput);
            (0, vitest_1.expect)(mockLoggerError).not.toHaveBeenCalled();
        }));
        (0, vitest_1.it)("should call SendGrid exactly once", () => __awaiter(void 0, void 0, void 0, function* () {
            mockSend.mockResolvedValueOnce([]);
            yield service.send(baseInput);
            (0, vitest_1.expect)(mockSend).toHaveBeenCalledTimes(1);
        }));
    });
});
