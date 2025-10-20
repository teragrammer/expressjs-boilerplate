import "mocha";
import request from "supertest";
import {assert} from "chai";
import app from "../../src";
import {Credentials, mockCredential} from "../utils";
import {UserInterface} from "../../src/interfaces/user.interface";
import {RoleInterface} from "../../src/interfaces/role.interface";

describe("HTTP Account", async () => {
    let credential: Credentials;
    let id: any;
    let role: RoleInterface;
    const phone = "+639281214573";

    it("generate credential", async () => {
        credential = await mockCredential(app, {role: "admin", username: "test_admin"});
        role = await app.knex.table("roles").where("slug", "customer").first();

        await app.knex.table("users").where("phone", phone).delete();
    });

    it("POST /api/v1/users", async () => {
        return request(app)
            .post("/api/v1/users")
            .send({
                first_name: "FTest",
                last_name: "LTest",
                role_id: role.id,
                phone,
            })
            .set("Content-Type", "application/json")
            .set("Authorization", `Bearer ${credential.token}`)
            .then(async (response: any) => {
                id = response.body.id;
                assert.equal(response.status, 200);
            });
    });

    it("POST /api/v1/users (duplicate phone)", async () => {
        return request(app)
            .post("/api/v1/users")
            .send({
                first_name: "FTest",
                last_name: "LTest",
                role_id: role.id,
                phone,
            })
            .set("Content-Type", "application/json")
            .set("Authorization", `Bearer ${credential.token}`)
            .then(async (response: any) => {
                assert.equal(response.status, 400);
            });
    });

    it("PUT /api/v1/users/:id", async () => {
        const newName = "New FTest";
        return request(app)
            .put(`/api/v1/users/${id}`)
            .send({
                first_name: newName,
                last_name: "LTest",
                role_id: role.id,
            })
            .set("Content-Type", "application/json")
            .set("Authorization", `Bearer ${credential.token}`)
            .then(async (response: any) => {
                const user: UserInterface = await app.knex.table("users").where("id", id).first();

                assert.equal(response.status, 200);
                assert.equal(user.first_name, newName);
            });
    });

    it("GET /api/v1/users", async () => {
        return request(app)
            .get("/api/v1/users")
            .query({
                search: "LTest",
            })
            .set("Content-Type", "application/json")
            .set("Authorization", `Bearer ${credential.token}`)
            .then(async (response: any) => {
                assert.equal(response.status, 200);
            });
    });

    it("GET /api/v1/users/:id", async () => {
        return request(app)
            .get(`/api/v1/users/${id}`)
            .set("Content-Type", "application/json")
            .set("Authorization", `Bearer ${credential.token}`)
            .then(async (response: any) => {
                assert.equal(response.status, 200);
                assert.equal(response.body.last_name, "LTest");
            });
    });

    it("DELETE /api/v1/users/:id", async () => {
        return request(app)
            .delete(`/api/v1/users/${id}`)
            .set("Content-Type", "application/json")
            .set("Authorization", `Bearer ${credential.token}`)
            .then(async (response: any) => {
                assert.equal(response.status, 200);
            });
    });
});