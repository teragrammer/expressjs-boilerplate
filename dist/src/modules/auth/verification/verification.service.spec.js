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
const verification_service_1 = require("./verification.service");
const outbox_interface_1 = require("../../jobs/outbox.interface");
const messages_1 = __importDefault(require("../../../common/utils/messages"));
(0, vitest_1.describe)("VerificationService", () => {
    let service;
    let securityUtil;
    let verificationRepository;
    let userRepository;
    let settingService;
    let outboxRepository;
    let mailService;
    let dateUtil;
    const policy = {
        emailTtlHours: 24,
        phoneTtlMinutes: 10,
        maxAttempts: 5,
        requiredForRecovery: false,
    };
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.clearAllMocks();
        securityUtil = {
            hash: vitest_1.vi.fn().mockResolvedValue("hashed"),
        };
        verificationRepository = {
            create: vitest_1.vi.fn().mockResolvedValue({ id: "v1" }),
            findByHash: vitest_1.vi.fn(),
            invalidateForUserChannel: vitest_1.vi.fn().mockResolvedValue(1),
            incrementAttempts: vitest_1.vi.fn(),
            consume: vitest_1.vi.fn(),
            isTargetVerified: vitest_1.vi.fn().mockResolvedValue(true),
        };
        userRepository = { update: vitest_1.vi.fn() };
        settingService = {
            getCache: vitest_1.vi.fn().mockResolvedValue({
                pri: {
                    ver_eml_snd: "no-reply@example.com",
                    ver_eml_sbj: "Verify",
                    ver_eml_ttl: "24",
                    ver_phn_ttl: "10",
                    ver_max_try: "5",
                    ver_req_rcv: "0",
                },
            }),
        };
        outboxRepository = { enqueue: vitest_1.vi.fn().mockResolvedValue({ id: "1" }) };
        mailService = { send: vitest_1.vi.fn() };
        dateUtil = {
            expiredAt: vitest_1.vi.fn().mockReturnValue(new Date("2030-01-01")),
        };
        service = new verification_service_1.VerificationService(securityUtil, verificationRepository, userRepository, settingService, outboxRepository, mailService, dateUtil);
    });
    (0, vitest_1.describe)("getPolicy()", () => {
        (0, vitest_1.it)("reads the policy from the settings", () => __awaiter(void 0, void 0, void 0, function* () {
            const result = yield service.getPolicy();
            (0, vitest_1.expect)(result).toEqual(policy);
        }));
    });
    (0, vitest_1.describe)("send()", () => {
        (0, vitest_1.it)("stores a hashed token and queues the email", () => __awaiter(void 0, void 0, void 0, function* () {
            const result = yield service.send(1, "email", "user@example.com");
            (0, vitest_1.expect)(result.sent).toBe(true);
            (0, vitest_1.expect)(result.expiresAt).toBeInstanceOf(Date);
            const stored = verificationRepository.create.mock.calls[0][0];
            (0, vitest_1.expect)(stored.token_hash).toMatch(/^[a-f0-9]{64}$/);
            (0, vitest_1.expect)(stored.token_hash).not.toBe(stored.token_hash.toUpperCase());
            (0, vitest_1.expect)(stored.user_id).toBe(1);
            (0, vitest_1.expect)(stored.channel).toBe("email");
            (0, vitest_1.expect)(outboxRepository.enqueue).toHaveBeenCalledWith(vitest_1.expect.objectContaining({ type: outbox_interface_1.OUTBOX_TYPES.SEND_EMAIL }));
        }));
        (0, vitest_1.it)("invalidates the previous token for the channel", () => __awaiter(void 0, void 0, void 0, function* () {
            yield service.send(1, "email", "user@example.com");
            (0, vitest_1.expect)(verificationRepository.invalidateForUserChannel).toHaveBeenCalledWith(1, "email");
        }));
        (0, vitest_1.it)("does not queue an email for the phone channel", () => __awaiter(void 0, void 0, void 0, function* () {
            yield service.send(1, "phone", "+1234567890");
            (0, vitest_1.expect)(outboxRepository.enqueue).not.toHaveBeenCalled();
        }));
    });
    (0, vitest_1.describe)("confirm()", () => {
        (0, vitest_1.it)("consumes the token and sets the verification flag", () => __awaiter(void 0, void 0, void 0, function* () {
            verificationRepository.findByHash.mockResolvedValue({
                id: "v1",
                user_id: 1,
                channel: "email",
                target: "user@example.com",
                token_hash: "hash",
                expires_at: new Date(Date.now() + 60000),
                consumed_at: null,
                attempts: 0,
            });
            const result = yield service.confirm(1, "token");
            (0, vitest_1.expect)(result).toEqual({ verified: true, channel: "email" });
            (0, vitest_1.expect)(verificationRepository.consume).toHaveBeenCalledWith("v1");
            (0, vitest_1.expect)(userRepository.update).toHaveBeenCalledWith(1, {
                is_email_verified: true,
            });
        }));
        (0, vitest_1.it)("sets the phone flag for a phone token", () => __awaiter(void 0, void 0, void 0, function* () {
            verificationRepository.findByHash.mockResolvedValue({
                id: "v1",
                user_id: 1,
                channel: "phone",
                target: "+1234567890",
                token_hash: "hash",
                expires_at: new Date(Date.now() + 60000),
                consumed_at: null,
                attempts: 0,
            });
            yield service.confirm(1, "token");
            (0, vitest_1.expect)(userRepository.update).toHaveBeenCalledWith(1, {
                is_phone_verified: true,
            });
        }));
        (0, vitest_1.it)("rejects an unknown token", () => __awaiter(void 0, void 0, void 0, function* () {
            verificationRepository.findByHash.mockResolvedValue(null);
            yield (0, vitest_1.expect)(service.confirm(1, "token")).rejects.toMatchObject({
                errorCode: messages_1.default.INVALID_TOKEN.code,
            });
        }));
        (0, vitest_1.it)("rejects a token belonging to another user", () => __awaiter(void 0, void 0, void 0, function* () {
            verificationRepository.findByHash.mockResolvedValue({
                id: "v1",
                user_id: 2,
                channel: "email",
                target: "user@example.com",
                token_hash: "hash",
                expires_at: new Date(Date.now() + 60000),
                consumed_at: null,
                attempts: 0,
            });
            yield (0, vitest_1.expect)(service.confirm(1, "token")).rejects.toMatchObject({
                errorCode: messages_1.default.INVALID_TOKEN.code,
            });
        }));
        (0, vitest_1.it)("rejects a token that was already used", () => __awaiter(void 0, void 0, void 0, function* () {
            verificationRepository.findByHash.mockResolvedValue({
                id: "v1",
                user_id: 1,
                channel: "email",
                target: "user@example.com",
                token_hash: "hash",
                expires_at: new Date(Date.now() + 60000),
                consumed_at: new Date(),
                attempts: 0,
            });
            yield (0, vitest_1.expect)(service.confirm(1, "token")).rejects.toMatchObject({
                errorCode: messages_1.default.INVALID_TOKEN.code,
            });
        }));
        (0, vitest_1.it)("rejects an expired token", () => __awaiter(void 0, void 0, void 0, function* () {
            verificationRepository.findByHash.mockResolvedValue({
                id: "v1",
                user_id: 1,
                channel: "email",
                target: "user@example.com",
                token_hash: "hash",
                expires_at: new Date(Date.now() - 1000),
                consumed_at: null,
                attempts: 0,
            });
            yield (0, vitest_1.expect)(service.confirm(1, "token")).rejects.toMatchObject({
                errorCode: messages_1.default.EXPIRED_TOKEN.code,
            });
        }));
        (0, vitest_1.it)("rejects a token that used up its attempts", () => __awaiter(void 0, void 0, void 0, function* () {
            verificationRepository.findByHash.mockResolvedValue({
                id: "v1",
                user_id: 1,
                channel: "email",
                target: "user@example.com",
                token_hash: "hash",
                expires_at: new Date(Date.now() + 60000),
                consumed_at: null,
                attempts: 5,
            });
            yield (0, vitest_1.expect)(service.confirm(1, "token")).rejects.toMatchObject({
                errorCode: messages_1.default.TOO_MANY_ATTEMPTS.code,
            });
        }));
    });
    (0, vitest_1.describe)("resetFlag()", () => {
        (0, vitest_1.it)("invalidates the tokens and clears the flag", () => __awaiter(void 0, void 0, void 0, function* () {
            yield service.resetFlag(1, "email");
            (0, vitest_1.expect)(verificationRepository.invalidateForUserChannel).toHaveBeenCalledWith(1, "email");
            (0, vitest_1.expect)(userRepository.update).toHaveBeenCalledWith(1, {
                is_email_verified: false,
            });
        }));
        (0, vitest_1.it)("clears the phone flag", () => __awaiter(void 0, void 0, void 0, function* () {
            yield service.resetFlag(1, "phone");
            (0, vitest_1.expect)(userRepository.update).toHaveBeenCalledWith(1, {
                is_phone_verified: false,
            });
        }));
    });
    (0, vitest_1.describe)("isTargetVerified()", () => {
        (0, vitest_1.it)("delegates to the repository", () => __awaiter(void 0, void 0, void 0, function* () {
            const result = yield service.isTargetVerified(1, "email", "user@example.com");
            (0, vitest_1.expect)(result).toBe(true);
            (0, vitest_1.expect)(verificationRepository.isTargetVerified).toHaveBeenCalledWith(1, "email", "user@example.com");
        }));
    });
});
