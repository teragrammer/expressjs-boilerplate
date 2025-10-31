import "mocha";
import request from "supertest";
import {assert} from "chai";
import app from "../../src";
import {Credentials, mockCredential} from "../utils";
import {RoleInterface} from "../../src/interfaces/role.interface";
import {DBKnex} from "../../src/configurations/knex";
import {RoleModel} from "../../src/models/role.model";

describe("HTTP Route Guard", async () => {
    let credential: Credentials;
    let id: any;
    let role: RoleInterface;

    it("generate credential", async () => credential = await mockCredential({role: "admin", username: "test_admin"}));

    it("POST /api/v1/route/guards", async () => {
        role = await RoleModel(app.get("knex")).table().where("slug", "admin").first();

        return request(app)
            .post("/api/v1/route/guards")
            .send({
                role_id: role.id,
                route: "test",
            })
            .set("Content-Type", "application/json")
            .set("Authorization", `Bearer ${credential.token}`)
            .then(async (response: any) => {
                id = response.body.id;
                assert.equal(response.status, 200);
            });
    });

    it("GET /api/v1/route/guards", async () => {
        return request(app)
            .get("/api/v1/route/guards")
            .query({
                role_id: role.id,
            })
            .set("Content-Type", "application/json")
            .set("Authorization", `Bearer ${credential.token}`)
            .then(async (response: any) => {
                assert.equal(response.status, 200);
            });
    });

    it("GET /api/v1/route/guards/:id", async () => {
        return request(app)
            .get(`/api/v1/route/guards/${id}`)
            .set("Content-Type", "application/json")
            .set("Authorization", `Bearer ${credential.token}`)
            .then(async (response: any) => {
                assert.equal(response.status, 200);
                assert.equal(response.body.role_id, role.id);
            });
    });

    it("DELETE /api/v1/route/guards/:id", async () => {
        return request(app)
            .delete(`/api/v1/route/guards/${id}`)
            .set("Content-Type", "application/json")
            .set("Authorization", `Bearer ${credential.token}`)
            .then(async (response: any) => {
                assert.equal(response.status, 200);
            });
    });
});