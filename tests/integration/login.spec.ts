// tests/integration/login.spec.ts
import {describe, expect, it} from "vitest";
import request from "supertest";

import app from "../../src/app";
import {DBKnex} from "../../src/config/knex";
import {securityUtil} from "../../src/config/container";

describe("POST /api/v1/auth/login", () => {
    it("should login an existing user with valid credentials", async () => {
        const username = securityUtil.randomString(8);
        const password = "12345678";
        const hashedPassword = await securityUtil.hash(password);

        // Get an existing role required by the users table.
        const role = await DBKnex("roles")
            .where({slug: "customer"})
            .first();

        expect(role).toBeDefined();

        await DBKnex("users").insert({
            username,
            password: hashedPassword,
            role_id: role.id,
        });

        const response = await request(app)
            .post("/api/v1/auth/login")
            .send({
                username,
                password,
            });

        expect(response.status).toBe(200);

        expect(response.body).toEqual({
            token: expect.any(String),
        });

        expect(response.body.token).toBeTruthy();
    });
});