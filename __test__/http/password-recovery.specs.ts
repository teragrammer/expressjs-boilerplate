import "mocha";
import request from "supertest";
import {assert} from "chai";
import app from "../../src";
import {Credentials, mockCredential} from "../utils";
import {UserInterface} from "../../src/interfaces/user.interface";
import {SecurityUtil} from "../../src/utilities/security.util";
import {DatabaseMiddleware} from "../../src/http/middlewares/database.middleware";

describe("HTTP Password Recovery", async () => {
    let credential: Credentials;
    let user: UserInterface;

    it("generate credential", async () => {
        credential = await mockCredential({role: "admin", username: "test_admin"});
        user = await DatabaseMiddleware().table("users").where("id", credential.user.id).first();
    });

    it("POST /api/v1/password-recovery/send", async () => {
        return request(app)
            .post("/api/v1/password-recovery/send")
            .send({
                to: "email",
                email: user.email,
            })
            .set("Content-Type", "application/json")
            .then(async (response: any) => {
                assert.equal(response.status, 200);
            });
    });

    it("POST /api/v1/password-recovery/send, failed", async () => {
        return request(app)
            .post("/api/v1/password-recovery/send")
            .send({
                to: "email",
                email: user.email,
            })
            .set("Content-Type", "application/json")
            .then(async (response: any) => {
                assert.equal(response.status, 400);
            });
    });

    it("POST /api/v1/password-recovery/validate, failed", async () => {
        return request(app)
            .post("/api/v1/password-recovery/validate")
            .send({
                to: "email",
                email: user.email,
                code: "123456",
            })
            .set("Content-Type", "application/json")
            .then(async (response: any) => {
                assert.equal(response.status, 400);
            });
    });

    it("POST /api/v1/password-recovery/validate", async () => {
        await DatabaseMiddleware().table("password_recoveries")
            .where("send_to", user.email)
            .update({
                code: await SecurityUtil().hash("123456"),
            });

        return request(app)
            .post("/api/v1/password-recovery/validate")
            .send({
                to: "email",
                email: user.email,
                code: "123456",
            })
            .set("Content-Type", "application/json")
            .then(async (response: any) => {
                assert.equal(response.status, 200);
            });
    });
});