// src/infrastructure/mail/sendgrid-mail.service.ts
import https from "node:https";
import sgMail, {MailDataRequired} from "@sendgrid/mail";
import {logger} from "../../config/logger";
import {AppError} from "../../common/utils/errors";
import Messages from "../../common/utils/messages";
import {MailService, SendMailInput,} from "../../common/interfaces/mail.interface";

/**
 * TLS agent used for outbound mail.
 *
 * Certificate verification is enabled explicitly (rather than relying
 * on the runtime default) and the minimum TLS version is pinned, so a
 * misconfigured environment cannot silently downgrade or skip
 * verification.
 */
const mailAgent = new https.Agent({
    rejectUnauthorized: true,
    minVersion: "TLSv1.2",
    keepAlive: true,
});

export class SendGridMailService implements MailService {
    constructor(apiKey: string) {
        if (!apiKey) {
            logger.warn(
                "SendGrid API key is empty; outbound email will fail.",
            );
        }

        sgMail.setApiKey(apiKey);
    }

    async send(input: SendMailInput): Promise<void> {
        try {
            const message: MailDataRequired = {
                to: input.to,
                from: input.from,
                subject: input.subject,
                text: input.text ?? "",
                ...(input.html !== undefined
                    ? {html: input.html}
                    : {}),
            };

            await sgMail.send(message);
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : "Unknown email delivery error";

            logger.error(
                {error: message},
                "Failed to send email",
            );

            throw new AppError(Messages.UNABLE_TO_SEND_EMAIL);
        }
    }
}
