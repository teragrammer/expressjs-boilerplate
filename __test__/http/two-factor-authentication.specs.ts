import "mocha";
import request from "supertest";
import {assert} from "chai";
import app from "../../src";
import {Credentials, mockCredential} from "../utils";
import {SecurityUtil} from "../../src/utilities/security.util";
import {DBKnex} from "../../src/connectors/databases/knex";

describe("HTTP Authentication", () => {
    let credential: Credentials;

    it("generate credential", async () => {
        await DBKnex.table("settings").where("slug", "tta_req").update({value: "1"});

        credential = await mockCredential({role: "customer", username: "test_customer", tfa: "hol"});
    });

    it("GET /api/v1/tfa/send", async () => {
        return request(app)
            .get("/api/v1/tfa/send")
            .set("Content-Type", "application/json")
            .set("Authorization", `Bearer ${credential.token}`)
            .then(async (response: any) => {
                const code = await SecurityUtil().hash("123456");
                await DBKnex.table("two_factor_authentications").where("id", response.body.id).update({code});

                assert.equal(response.status, 200);
            });
    });

    it("POST /api/v1/tfa/validate", async () => {
        return request(app)
            .post("/api/v1/tfa/validate")
            .send({
                code: "123456",
            })
            .set("Content-Type", "application/json")
            .set("Authorization", `Bearer ${credential.token}`)
            .then(async (response: any) => {
                await DBKnex.table("settings").where("slug", "tta_req").update({value: "0"});
                assert.equal(response.status, 200);
            });
    });
});