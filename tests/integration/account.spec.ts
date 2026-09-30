// tests/integration/account.spec.ts
import {afterEach, describe, expect, it} from "vitest";
import request from "supertest";

import app from "../../src/app";
import {DBKnex} from "../../src/config/knex";
import {securityUtil, tokenService,} from "../../src/config/container";

const createAuthenticatedUser = async () => {
    const username = securityUtil.randomString(8);
    const email = `${username}@example.com`;
    const password = "OldPassword123!";

    const role = await DBKnex("roles")
        .where({slug: "customer"})
        .first();

    if (!role) {
        throw new Error(
            "Customer role is required for account integration test",
        );
    }

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

    const [authenticationToken] = await DBKnex(
        "authentication_tokens",
    )
        .insert({
            user_id: user.id,
            expired_at: new Date(Date.now() + 60 * 60 * 1000),
        })
        .returning("*");

    if (!authenticationToken) {
        throw new Error(
            "Unable to create authentication token",
        );
    }

    const token = tokenService.generateToken({
        uid: user.id,
        tid: authenticationToken.id,
        tfa: true,
    });

    return {
        user,
        username,
        email,
        password,
        authenticationToken,
        token,
    };
};

describe("User account", () => {
    afterEach(async () => {
        await DBKnex("authentication_tokens").del();
        await DBKnex("users").del();
    });

    describe("PUT /api/v1/account/information", () => {
        it("should update the authenticated user's information", async () => {
            const {
                user,
                token,
            } = await createAuthenticatedUser();

            const response = await request(app)
                .put("/api/v1/account/information")
                .set("Authorization", `Bearer ${token}`)
                .send({
                    first_name: "John",
                    middle_name: "Michael",
                    last_name: "Doe",
                    address: "123 Main Street, Singapore",
                });

            expect(response.status).toBe(200);

            expect(response.body).toEqual(
                expect.any(String),
            );

            const updatedUser = await DBKnex("users")
                .where({id: user.id})
                .first();

            expect(updatedUser).toBeDefined();

            expect(updatedUser.first_name).toBe("John");
            expect(updatedUser.middle_name).toBe("Michael");
            expect(updatedUser.last_name).toBe("Doe");
            expect(updatedUser.address).toBe(
                "123 Main Street, Singapore",
            );
        });

        it("should return a new token containing the authenticated user's id", async () => {
            const {
                user,
                token,
            } = await createAuthenticatedUser();

            const response = await request(app)
                .put("/api/v1/account/information")
                .set("Authorization", `Bearer ${token}`)
                .send({
                    first_name: "Jane",
                    last_name: "Doe",
                    address: "456 Orchard Road, Singapore",
                });

            expect(response.status).toBe(200);
            expect(response.body).toEqual(
                expect.any(String),
            );

            const newToken = tokenService.verifyToken(
                response.body,
            );

            expect(newToken.uid).toBe(user.id);
            expect(newToken.tfa).toBe(false);
            expect(newToken.tid).toBe(0);
        });

        it("should reject information updates without authentication", async () => {
            const response = await request(app)
                .put("/api/v1/account/information")
                .send({
                    first_name: "John",
                    last_name: "Doe",
                    address: "123 Main Street, Singapore",
                });

            expect(response.status).toBe(401);
        });

        it("should reject information updates when TFA is incomplete", async () => {
            const {
                user,
                authenticationToken,
            } = await createAuthenticatedUser();

            const token = tokenService.generateToken({
                uid: user.id,
                tid: authenticationToken.id,
                tfa: false,
            });

            const response = await request(app)
                .put("/api/v1/account/information")
                .set("Authorization", `Bearer ${token}`)
                .send({
                    first_name: "John",
                    last_name: "Doe",
                    address: "123 Main Street, Singapore",
                });

            expect(response.status).toBe(403);
        });

        it("should reject invalid information", async () => {
            const {token} = await createAuthenticatedUser();

            const response = await request(app)
                .put("/api/v1/account/information")
                .set("Authorization", `Bearer ${token}`)
                .send({
                    first_name: "",
                    last_name: "",
                    address: "short",
                });

            expect(response.status).not.toBe(200);
        });
    });

    describe("PUT /api/v1/account/password", () => {
        it("should change the authenticated user's password", async () => {
            const {
                user,
                username,
                password: oldPassword,
                token,
            } = await createAuthenticatedUser();

            const newPassword = "NewPassword123!";

            const response = await request(app)
                .put("/api/v1/account/password")
                .set("Authorization", `Bearer ${token}`)
                .send({
                    current_password: oldPassword,
                    new_password: newPassword,
                });

            expect(response.status).toBe(200);

            expect(response.body).toEqual(
                expect.any(String),
            );

            const updatedUser = await DBKnex("users")
                .where({id: user.id})
                .first();

            expect(updatedUser).toBeDefined();
            expect(updatedUser.password).toBeDefined();

            const passwordMatches = await securityUtil.compare(
                updatedUser.password,
                newPassword,
            );

            expect(passwordMatches).toBe(true);

            const loginResponse = await request(app)
                .post("/api/v1/auth/login")
                .send({
                    username,
                    password: newPassword,
                });

            expect(loginResponse.status).toBe(200);

            expect(loginResponse.body).toEqual({
                token: expect.any(String),
            });
        });

        it("should reject the password change when the current password is incorrect", async () => {
            const {
                user,
                token,
            } = await createAuthenticatedUser();

            const response = await request(app)
                .put("/api/v1/account/password")
                .set("Authorization", `Bearer ${token}`)
                .send({
                    current_password: "WrongPassword123!",
                    new_password: "NewPassword123!",
                });

            expect(response.status).not.toBe(200);

            const unchangedUser = await DBKnex("users")
                .where({id: user.id})
                .first();

            const originalPasswordMatches =
                await securityUtil.compare(
                    unchangedUser.password,
                    "OldPassword123!",
                );

            expect(originalPasswordMatches).toBe(true);
        });

        it("should update the username and email together with the password", async () => {
            const {
                user,
                password: oldPassword,
                token,
            } = await createAuthenticatedUser();

            const newUsername = securityUtil.randomString(10);
            const newEmail = `${newUsername}@example.com`;
            const newPassword = "NewPassword123!";

            const response = await request(app)
                .put("/api/v1/account/password")
                .set("Authorization", `Bearer ${token}`)
                .send({
                    current_password: oldPassword,
                    new_password: newPassword,
                    username: newUsername,
                    email: newEmail,
                });

            expect(response.status).toBe(200);

            expect(response.body).toEqual(
                expect.any(String),
            );

            const updatedUser = await DBKnex("users")
                .where({id: user.id})
                .first();

            expect(updatedUser.username).toBe(newUsername);
            expect(updatedUser.email).toBe(newEmail);

            const loginResponse = await request(app)
                .post("/api/v1/auth/login")
                .send({
                    username: newUsername,
                    password: newPassword,
                });

            expect(loginResponse.status).toBe(200);

            expect(loginResponse.body).toEqual({
                token: expect.any(String),
            });
        });

        it("should reject password changes without authentication", async () => {
            const response = await request(app)
                .put("/api/v1/account/password")
                .send({
                    current_password: "OldPassword123!",
                    new_password: "NewPassword123!",
                });

            expect(response.status).toBe(401);
        });

        it("should reject password changes when TFA is incomplete", async () => {
            const {
                user,
                authenticationToken,
            } = await createAuthenticatedUser();

            const token = tokenService.generateToken({
                uid: user.id,
                tid: authenticationToken.id,
                tfa: false,
            });

            const response = await request(app)
                .put("/api/v1/account/password")
                .set("Authorization", `Bearer ${token}`)
                .send({
                    current_password: "OldPassword123!",
                    new_password: "NewPassword123!",
                });

            expect(response.status).toBe(403);
        });

        it("should reject a password that does not meet the security requirements", async () => {
            const {
                token,
                password: oldPassword,
            } = await createAuthenticatedUser();

            const response = await request(app)
                .put("/api/v1/account/password")
                .set("Authorization", `Bearer ${token}`)
                .send({
                    current_password: oldPassword,
                    new_password: "weakpassword",
                });

            expect(response.status).not.toBe(200);
        });
    });
});