import "mocha";
import request from "supertest";
import {assert} from "chai";
import app from "../../src";
import {Credentials, mockCredential} from "../utils";
import {SettingInterface} from "../../src/interfaces/setting.interface";
import {DBKnex} from "../../src/connectors/databases/knex";

describe("HTTP Account", async () => {
    let credential: Credentials;
    let id: any;

    it("generate credential", async () => {
        await DBKnex.table("settings").where("slug", "test").delete();

        credential = await mockCredential({role: "admin", username: "test_admin"});
    });

    it("POST /api/v1/settings", async () => {
        return request(app)
            .post("/api/v1/settings")
            .send({
                name: "Test",
                slug: "test",
                value: "test_value",
                type: "string",
                is_disabled: "0",
                is_public: "1",
            })
            .set("Content-Type", "application/json")
            .set("Authorization", `Bearer ${credential.token}`)
            .then(async (response: any) => {
                id = response.body.id;
                assert.equal(response.status, 200);
            });
    });

    it("PUT /api/v1/settings/:id", async () => {
        const newName = "New Test";
        return request(app)
            .put(`/api/v1/settings/${id}`)
            .send({
                name: newName,
                slug: "test",
                value: "test_value",
                type: "string",
                is_disabled: "0",
                is_public: "1",
            })
            .set("Content-Type", "application/json")
            .set("Authorization", `Bearer ${credential.token}`)
            .then(async (response: any) => {
                const setting: SettingInterface = await DBKnex.table("settings").where("id", id).first();

                assert.equal(response.status, 200);
                assert.equal(setting.name, newName);
            });
    });

    it("GET /api/v1/settings", async () => {
        return request(app)
            .get("/api/v1/settings")
            .query({
                search: "test",
            })
            .set("Content-Type", "application/json")
            .set("Authorization", `Bearer ${credential.token}`)
            .then(async (response: any) => {
                assert.equal(response.status, 200);
            });
    });

    it("GET /api/v1/settings/values", async () => {
        return request(app)
            .get("/api/v1/settings/values")
            .query({
                search: "test",
            })
            .set("Content-Type", "application/json")
            .set("Authorization", `Bearer ${credential.token}`)
            .then(async (response: any) => {
                assert.equal(response.status, 200);
                assert.equal(response.body.test, "test_value");
            });
    });

    it("GET /api/v1/settings/:id", async () => {
        return request(app)
            .get(`/api/v1/settings/${id}`)
            .set("Content-Type", "application/json")
            .set("Authorization", `Bearer ${credential.token}`)
            .then(async (response: any) => {
                assert.equal(response.status, 200);
                assert.equal(response.body.value, "test_value");
            });
    });

    it("DELETE /api/v1/settings/:id", async () => {
        return request(app)
            .delete(`/api/v1/settings/${id}`)
            .set("Content-Type", "application/json")
            .set("Authorization", `Bearer ${credential.token}`)
            .then(async (response: any) => {
                assert.equal(response.status, 200);
            });
    });
});