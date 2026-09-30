// tests/integration/password-recovery.spec.ts
import {afterEach, describe, expect, it, vi} from "vitest";
import request from "supertest";
import sgMail from "@sendgrid/mail";

import app from "../../src/app";
import {DBKnex} from "../../src/config/knex";
import {securityUtil} from "../../src/config/container";

const createTestUser = async () => {
    const username = securityUtil.randomString(8);
    const email = `${username}@example.com`;

    const role = await DBKnex("roles")
        .where({slug: "customer"})
        .first();

    if (!role) {
        throw new Error(
            "Customer role is required for password recovery integration test",
        );
    }

    const password = "OldPassword123!";
    const hashedPassword = await securityUtil.hash(password);

    const [user] = await DBKnex("users")
        .insert({
            username,
            email,
            password: hashedPassword,
            role_id: role.id,
        })
        .returning("*");

    if (!user) {
        throw new Error("Unable to create test user");
    }

    return {
        user,
        username,
        email,
        password,
    };
};

const getSentMail = (
    sendMailSpy: ReturnType<typeof vi.spyOn>,
) => {
    const mail = sendMailSpy.mock.calls[0]?.[0];

    if (!mail) {
        throw new Error("Expected SendGrid send() to be called");
    }

    if (Array.isArray(mail)) {
        throw new Error(
            "Expected SendGrid to receive a single mail message",
        );
    }

    return mail;
};

describe("Password recovery", () => {
    afterEach(async () => {
        vi.restoreAllMocks();

        // Keep tests isolated if a recovery record remains because
        // a test intentionally exercises an unsuccessful workflow.
        await DBKnex("password_recoveries").del();
    });

    it("should send a password recovery code to an existing user's email", async () => {
        const {email} = await createTestUser();

        const sendMailSpy = vi
            .spyOn(sgMail, "send")
            .mockResolvedValue([] as any);

        const response = await request(app)
            .post("/api/v1/auth/password-recovery/send")
            .send({
                type: "email",
                send_to: email,
            });

        expect(response.status).toBe(200);

        expect(response.body).toEqual({
            status: "success",
            message:
                "If an account matches those credentials, a reset code has been sent.",
            data: {
                next_resend_at: expect.any(String),
            },
        });

        expect(sendMailSpy).toHaveBeenCalledTimes(1);

        const mail = getSentMail(sendMailSpy);

        expect(mail.to).toBe(email);
        expect(mail.text).toMatch(/^Recovery Code: \d+$/);

        const plainCode = mail.text!.replace(
            "Recovery Code: ",
            "",
        );

        expect(plainCode).toMatch(/^\d+$/);

        const recovery = await DBKnex("password_recoveries")
            .where({
                type: "email",
                send_to: email,
            })
            .first();

        expect(recovery).toBeDefined();

        expect(recovery.tries).toBe(0);
        expect(recovery.next_try_at).toBeNull();
        expect(recovery.next_resend_at).toBeDefined();
        expect(recovery.expired_at).toBeDefined();

        const isCodeValid = await securityUtil.compare(
            recovery.code,
            plainCode,
        );

        expect(isCodeValid).toBe(true);
    });

    it("should reset the user's password with a valid recovery code", async () => {
        const {
            user,
            email,
            username,
            password: oldPassword,
        } = await createTestUser();

        const sendMailSpy = vi
            .spyOn(sgMail, "send")
            .mockResolvedValue([] as any);

        const sendResponse = await request(app)
            .post("/api/v1/auth/password-recovery/send")
            .send({
                type: "email",
                send_to: email,
            });

        expect(sendResponse.status).toBe(200);

        const mail = getSentMail(sendMailSpy);

        expect(mail.to).toBe(email);
        expect(mail.text).toMatch(/^Recovery Code: \d+$/);

        const recoveryCode = mail.text!.replace(
            "Recovery Code: ",
            "",
        );

        const recovery = await DBKnex("password_recoveries")
            .where({
                type: "email",
                send_to: email,
            })
            .first();

        expect(recovery).toBeDefined();

        const newPassword = "NewPassword123!";

        const response = await request(app)
            .post("/api/v1/auth/password-recovery/validate")
            .send({
                type: "email",
                send_to: email,
                code: recoveryCode,
                new_password: newPassword,
            });

        expect(response.status).toBe(200);

        expect(response.body).toEqual({
            status: "success",
            message:
                "Password has been successfully reset. You can now log in with your new password.",
        });

        const deletedRecovery = await DBKnex("password_recoveries")
            .where({
                id: recovery.id,
            })
            .first();

        expect(deletedRecovery).toBeUndefined();

        const oldPasswordResponse = await request(app)
            .post("/api/v1/auth/login")
            .send({
                username,
                password: oldPassword,
            });

        expect(oldPasswordResponse.status).not.toBe(200);

        const newPasswordResponse = await request(app)
            .post("/api/v1/auth/login")
            .send({
                username,
                password: newPassword,
            });

        expect(newPasswordResponse.status).toBe(200);

        expect(newPasswordResponse.body).toEqual({
            token: expect.any(String),
        });

        expect(user.id).toBeDefined();
    });

    it("should reject an invalid recovery code", async () => {
        const {email} = await createTestUser();

        const sendMailSpy = vi
            .spyOn(sgMail, "send")
            .mockResolvedValue([] as any);

        const sendResponse = await request(app)
            .post("/api/v1/auth/password-recovery/send")
            .send({
                type: "email",
                send_to: email,
            });

        expect(sendResponse.status).toBe(200);
        expect(sendMailSpy).toHaveBeenCalledTimes(1);

        const recovery = await DBKnex("password_recoveries")
            .where({
                type: "email",
                send_to: email,
            })
            .first();

        expect(recovery).toBeDefined();
        expect(recovery.tries).toBe(0);

        const response = await request(app)
            .post("/api/v1/auth/password-recovery/validate")
            .send({
                type: "email",
                send_to: email,
                code: "999999",
                new_password: "NewPassword123!",
            });

        expect(response.status).not.toBe(200);

        expect(response.body).not.toEqual({
            status: "success",
            message:
                "Password has been successfully reset. You can now log in with your new password.",
        });

        const updatedRecovery = await DBKnex(
            "password_recoveries",
        )
            .where({
                id: recovery.id,
            })
            .first();

        expect(updatedRecovery).toBeDefined();
        expect(updatedRecovery.tries).toBe(1);
    });

    it("should not reveal whether an email belongs to an existing account", async () => {
        const email = `${securityUtil.randomString(8)}@example.com`;

        const sendMailSpy = vi
            .spyOn(sgMail, "send")
            .mockResolvedValue([] as any);

        const response = await request(app)
            .post("/api/v1/auth/password-recovery/send")
            .send({
                type: "email",
                send_to: email,
            });

        expect(response.status).toBe(200);

        expect(response.body).toEqual({
            status: "success",
            message:
                "If an account matches those credentials, a reset code has been sent.",
            data: null,
        });

        expect(sendMailSpy).not.toHaveBeenCalled();

        const recovery = await DBKnex("password_recoveries")
            .where({
                type: "email",
                send_to: email,
            })
            .first();

        expect(recovery).toBeUndefined();
    });

    it("should reject password reset when no recovery record exists", async () => {
        const email = `${securityUtil.randomString(8)}@example.com`;

        const response = await request(app)
            .post("/api/v1/auth/password-recovery/validate")
            .send({
                type: "email",
                send_to: email,
                code: "123456",
                new_password: "NewPassword123!",
            });

        expect(response.status).not.toBe(200);

        expect(response.body).not.toEqual({
            status: "success",
            message:
                "Password has been successfully reset. You can now log in with your new password.",
        });
    });

    it("should reject an invalid password recovery request", async () => {
        const response = await request(app)
            .post("/api/v1/auth/password-recovery/send")
            .send({
                type: "email",
                send_to: "not-an-email",
            });

        expect(response.status).not.toBe(200);
    });
});