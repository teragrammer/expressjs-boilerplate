import {afterEach, beforeEach, describe, expect, it, vi,} from "vitest";
import request from "supertest";
import sgMail from "@sendgrid/mail";

import app from "../../src/app";
import {DBKnex} from "../../src/config/knex";
import {securityUtil, tokenService,} from "../../src/config/container";

interface TestUserContext {
    user: any;
    authenticationToken: any;
    token: string;
}

const createdUserIds: number[] = [];
const createdAuthenticationTokenIds: number[] = [];
const createdTfaIds: number[] = [];

const createAuthenticatedUser = async (): Promise<TestUserContext> => {
    const role = await DBKnex("roles")
        .where({slug: "customer"})
        .first();

    if (!role) {
        throw new Error(
            "Customer role is required for TFA integration test",
        );
    }

    /*
     * Keep username <= 16 characters because the database column
     * is varchar(16).
     */
    const username = `tfa_${Date.now()}_${Math.floor(
        Math.random() * 1000,
    )}`.slice(0, 16);

    const email = `${username}@example.com`;

    const [user] = await DBKnex("users")
        .insert({
            username,
            email,
            role_id: role.id,
            status: "Activated",
        })
        .returning("*");

    if (!user) {
        throw new Error("Unable to create test user");
    }

    /*
     * Normalize the database ID once.
     *
     * PostgreSQL drivers can return BIGINT values as strings.
     */
    const userId = Number(user.id);

    if (!Number.isSafeInteger(userId)) {
        throw new Error(
            `Invalid user ID returned by database: ${user.id}`,
        );
    }

    createdUserIds.push(userId);

    /*
     * Create the authentication token in the SAME database used
     * by the application.
     */
    const [authenticationToken] = await DBKnex(
        "authentication_tokens",
    )
        .insert({
            user_id: userId,
            expired_at: new Date(
                Date.now() + 60 * 60 * 1000,
            ),
        })
        .returning("*");

    if (!authenticationToken) {
        throw new Error(
            "Unable to create authentication token",
        );
    }

    const authenticationTokenId = Number(
        authenticationToken.id,
    );

    if (!Number.isSafeInteger(authenticationTokenId)) {
        throw new Error(
            `Invalid authentication token ID: ${authenticationToken.id}`,
        );
    }

    createdAuthenticationTokenIds.push(
        authenticationTokenId,
    );

    /*
     * VERY IMPORTANT:
     *
     * Verify that the exact token referenced by the JWT exists
     * before sending the request.
     *
     * This catches test-fixture/database problems before the
     * application gets involved.
     */
    const persistedToken = await DBKnex(
        "authentication_tokens",
    )
        .where({
            id: authenticationTokenId,
            user_id: userId,
        })
        .first();

    if (!persistedToken) {
        throw new Error(
            `Authentication token ${authenticationTokenId} was not persisted`,
        );
    }

    const token = tokenService.generateToken({
        uid: userId,
        tid: authenticationTokenId,
        tfa: false,
    });

    return {
        user,
        authenticationToken: {
            ...authenticationToken,
            id: authenticationTokenId,
        },
        token,
    };
};

const createTfaRecord = async (
    tokenId: number,
    plainOtp: string,
) => {
    /*
     * Always verify the parent authentication token first.
     *
     * This prevents the confusing PostgreSQL FK error and makes
     * the actual test-fixture problem obvious.
     */
    const authenticationToken = await DBKnex(
        "authentication_tokens",
    )
        .where({id: tokenId})
        .first();

    if (!authenticationToken) {
        throw new Error(
            `Cannot create TFA record: authentication token ${tokenId} does not exist`,
        );
    }

    const hashedOtp = await securityUtil.hash(
        plainOtp,
    );

    const [tfa] = await DBKnex(
        "two_factor_authentications",
    )
        .insert({
            token_id: tokenId,
            code: hashedOtp,
            expired_at: new Date(
                Date.now() + 5 * 60 * 1000,
            ),
            tries: 0,
            expired_tries_at: null,
        })
        .returning("*");

    if (!tfa) {
        throw new Error(
            "Unable to create TFA record",
        );
    }

    const tfaId = Number(tfa.id);

    if (!Number.isSafeInteger(tfaId)) {
        throw new Error(
            `Invalid TFA ID: ${tfa.id}`,
        );
    }

    createdTfaIds.push(tfaId);

    return {
        ...tfa,
        id: tfaId,
        token_id: Number(tfa.token_id),
    };
};

describe("Two-factor authentication", () => {
    beforeEach(async () => {
        /*
         * Nothing intentionally shared between tests.
         *
         * The important part is that each test gets a fresh
         * authentication token.
         */
    });

    afterEach(async () => {
        vi.restoreAllMocks();

        /*
         * Delete children before parents because of FK constraints.
         */
        if (createdTfaIds.length > 0) {
            await DBKnex("two_factor_authentications")
                .whereIn("id", createdTfaIds)
                .del();

            createdTfaIds.length = 0;
        }

        if (
            createdAuthenticationTokenIds.length > 0
        ) {
            await DBKnex("authentication_tokens")
                .whereIn(
                    "id",
                    createdAuthenticationTokenIds,
                )
                .del();

            createdAuthenticationTokenIds.length = 0;
        }

        if (createdUserIds.length > 0) {
            await DBKnex("users")
                .whereIn("id", createdUserIds)
                .del();

            createdUserIds.length = 0;
        }
    });

    describe("GET /api/v1/auth/tfa/send", () => {
        it("should send an OTP to the authenticated user's email", async () => {
            const {
                user,
                authenticationToken,
                token,
            } = await createAuthenticatedUser();

            const authenticationTokenId = Number(
                authenticationToken.id,
            );

            /*
             * Ensure the parent token exists immediately before
             * making the authenticated request.
             */
            const tokenBeforeRequest = await DBKnex(
                "authentication_tokens",
            )
                .where({
                    id: authenticationTokenId,
                })
                .first();

            expect(tokenBeforeRequest).toBeDefined();

            const sendMailSpy = vi
                .spyOn(sgMail, "send")
                .mockResolvedValue([] as any);

            const response = await request(app)
                .get("/api/v1/auth/tfa/send")
                .set(
                    "Authorization",
                    `Bearer ${token}`,
                );

            if (response.status !== 200) {
                console.error(
                    "TFA send response:",
                    response.status,
                    response.body,
                );
            }

            expect(response.status).toBe(200);

            expect(response.body).toEqual({
                id: expect.any(String),
                next_try: expect.any(String),
            });

            expect(sendMailSpy).toHaveBeenCalledTimes(
                1,
            );

            const mail =
                sendMailSpy.mock.calls[0][0];

            expect(Array.isArray(mail)).toBe(false);

            if (Array.isArray(mail)) {
                throw new Error(
                    "Expected SendGrid to receive a single mail message",
                );
            }

            expect(mail.to).toBe(user.email);
            expect(mail.text).toMatch(
                /^OTP Code: \d+$/,
            );

            const plainOtp = mail.text!.replace(
                "OTP Code: ",
                "",
            );

            const responseTfaId = Number(
                response.body.id,
            );

            expect(
                Number.isSafeInteger(responseTfaId),
            ).toBe(true);

            const tfa = await DBKnex(
                "two_factor_authentications",
            )
                .where({
                    id: responseTfaId,
                    token_id: authenticationTokenId,
                })
                .first();

            expect(tfa).toBeDefined();

            expect(Number(tfa.token_id)).toBe(
                authenticationTokenId,
            );

            expect(
                await securityUtil.compare(
                    tfa.code,
                    plainOtp,
                ),
            ).toBe(true);
        });
    });

    describe("POST /api/v1/auth/tfa/validate", () => {
        it("should validate a valid OTP and return a TFA-cleared token", async () => {
            const {
                user,
                authenticationToken,
                token,
            } = await createAuthenticatedUser();

            const userId = Number(user.id);
            const authenticationTokenId = Number(
                authenticationToken.id,
            );

            const plainOtp =
                securityUtil.randomNumber(6);

            const tfa = await createTfaRecord(
                authenticationTokenId,
                plainOtp,
            );

            const response = await request(app)
                .post(
                    "/api/v1/auth/tfa/validate",
                )
                .set(
                    "Authorization",
                    `Bearer ${token}`,
                )
                .send({
                    code: plainOtp,
                });

            if (response.status !== 200) {
                console.error(
                    "TFA validation response:",
                    response.status,
                    response.body,
                );
            }

            expect(response.status).toBe(200);

            expect(response.body).toEqual({
                token: expect.any(String),
            });

            const verifiedToken =
                tokenService.verifyToken(
                    response.body.token,
                );

            expect(verifiedToken).toEqual({
                uid: userId,
                tid: authenticationTokenId,
                tfa: true,
            });

            const deletedTfa = await DBKnex(
                "two_factor_authentications",
            )
                .where({id: tfa.id})
                .first();

            expect(deletedTfa).toBeUndefined();
        });

        it("should reject an invalid OTP", async () => {
            const {
                authenticationToken,
                token,
            } = await createAuthenticatedUser();

            const authenticationTokenId = Number(
                authenticationToken.id,
            );

            /*
             * Verify the parent exists before inserting the child.
             */
            const parentToken = await DBKnex(
                "authentication_tokens",
            )
                .where({
                    id: authenticationTokenId,
                })
                .first();

            expect(parentToken).toBeDefined();

            const tfa = await createTfaRecord(
                authenticationTokenId,
                "123456",
            );

            const response = await request(app)
                .post(
                    "/api/v1/auth/tfa/validate",
                )
                .set(
                    "Authorization",
                    `Bearer ${token}`,
                )
                .send({
                    code: "999999",
                });

            expect(response.status).not.toBe(200);
            expect(response.body).not.toHaveProperty(
                "token",
            );

            const persistedTfa = await DBKnex(
                "two_factor_authentications",
            )
                .where({id: tfa.id})
                .first();

            expect(persistedTfa).toBeDefined();
            expect(Number(persistedTfa.token_id)).toBe(
                authenticationTokenId,
            );
            expect(Number(persistedTfa.tries)).toBe(1);
        });
    });

    describe("Authentication requirements", () => {
        it("should reject unauthenticated OTP requests", async () => {
            const response = await request(app)
                .get("/api/v1/auth/tfa/send");

            expect(response.status).not.toBe(200);
            expect(response.body).not.toHaveProperty(
                "id",
            );
        });

        it("should reject unauthenticated OTP validation", async () => {
            const response = await request(app)
                .post(
                    "/api/v1/auth/tfa/validate",
                )
                .send({
                    code: "123456",
                });

            expect(response.status).not.toBe(200);
            expect(response.body).not.toHaveProperty(
                "token",
            );
        });
    });
});