import "mocha";
import request from "supertest";
import {assert} from "chai";
import app from "../../src";
import {Credentials, mockCredential} from "../utils";
import {UserInterface} from "../../src/interfaces/user.interface";
import {DBKnex} from "../../src/connectors/databases/knex";

describe("HTTP Account", async () => {
    let credential: Credentials;
    let username = "test_customer";

    const new_email = "test@gmail.com";
    const new_username = "test_123";
    const new_password = "abc.123";

    it("generate credential", async () => {
        await DBKnex.table("users").where("username", new_username).delete();

        credential = await mockCredential({role: "customer", username});
    });

    it("PUT /api/v1/account/information", async () => {
        return request(app)
            .put("/api/v1/account/information")
            .send({
                first_name: "User",
                last_name: "One",
            })
            .set("Content-Type", "application/json")
            .set("Authorization", `Bearer ${credential.token}`)
            .then(async (response: any) => {
                const user: UserInterface = await DBKnex.table("users").where("username", username).first();

                assert.equal(response.status, 200);
                assert.equal(user.first_name, "User");
                assert.equal(user.last_name, "One");
            });
    });

    it("PUT /api/v1/account/password", async () => {
        return request(app)
            .put("/api/v1/account/password")
            .send({
                current_password: "123456",
                username: new_username,
                email: new_email,
            })
            .set("Content-Type", "application/json")
            .set("Authorization", `Bearer ${credential.token}`)
            .then(async (response: any) => {
                const user: UserInterface = await DBKnex.table("users").where("username", new_username).first();

                assert.equal(response.status, 200);
                assert.equal(user.username, new_username);
                assert.equal(user.email, new_email);
            });
    });

    it("PUT /api/v1/account/password (new password)", async () => {
        return request(app)
            .put("/api/v1/account/password")
            .send({
                current_password: "123456",
                new_password: new_password,
            })
            .set("Content-Type", "application/json")
            .set("Authorization", `Bearer ${credential.token}`)
            .then(async (response: any) => {
                const user: UserInterface = await DBKnex.table("users").where("username", new_username).first();

                assert.equal(response.status, 200);
                assert.equal(user.username, new_username);
                assert.equal(user.email, new_email);
            });
    });

    it("POST /api/v1/login (test the new password)", async () => {
        return request(app)
            .post("/api/v1/login")
            .send({
                username: new_username,
                password: new_password,
            })
            .set("Content-Type", "application/json")
            .then((response: any) => {
                assert.equal(response.status, 200);
            });
    });
});