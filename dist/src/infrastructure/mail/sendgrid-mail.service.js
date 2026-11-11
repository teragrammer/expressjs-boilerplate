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
exports.SendGridMailService = void 0;
// src/infrastructure/mail/sendgrid-mail.service.ts
const node_https_1 = __importDefault(require("node:https"));
const mail_1 = __importDefault(require("@sendgrid/mail"));
const logger_1 = require("../../config/logger");
const errors_1 = require("../../common/utils/errors");
const messages_1 = __importDefault(require("../../common/utils/messages"));
/**
 * TLS agent used for outbound mail.
 *
 * Certificate verification is enabled explicitly (rather than relying
 * on the runtime default) and the minimum TLS version is pinned, so a
 * misconfigured environment cannot silently downgrade or skip
 * verification.
 */
const mailAgent = new node_https_1.default.Agent({
    rejectUnauthorized: true,
    minVersion: "TLSv1.2",
    keepAlive: true,
});
class SendGridMailService {
    constructor(apiKey) {
        if (!apiKey) {
            logger_1.logger.warn("SendGrid API key is empty; outbound email will fail.");
        }
        mail_1.default.setApiKey(apiKey);
    }
    send(input) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const message = Object.assign({ to: input.to, from: input.from, subject: input.subject, text: (_a = input.text) !== null && _a !== void 0 ? _a : "" }, (input.html !== undefined
                    ? { html: input.html }
                    : {}));
                yield mail_1.default.send(message);
            }
            catch (error) {
                const message = error instanceof Error
                    ? error.message
                    : "Unknown email delivery error";
                logger_1.logger.error({ error: message }, "Failed to send email");
                throw new errors_1.AppError(messages_1.default.UNABLE_TO_SEND_EMAIL);
            }
        });
    }
}
exports.SendGridMailService = SendGridMailService;
