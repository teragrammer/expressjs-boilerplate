// tests/integration/register.spec.ts
import {describe, expect, it} from "vitest";
import request from "supertest";
import app from "../../src/app";
import {db} from "../../src/config/database";
import {SecurityUtil} from "../../src/common/utils/security.util";

describe("POST /api/v1/auth/register", () => {
    it("should register a new user", async () => {
        const username = new SecurityUtil().randomString(8);

        const response = await request(app)
            .post("/api/v1/auth/register")
            .send({
                username,
                password: "12345678",
            });

        expect(response.status).toBe(201);

        expect(response.body).toEqual({
            token: expect.any(String),
        });

        const user = await db
            .selectFrom("users")
            .selectAll()
            .where("username", "=", username)
            .executeTakeFirst();

        expect(user).toBeDefined();
        expect(user!.username).toBe(username);
    });
});
