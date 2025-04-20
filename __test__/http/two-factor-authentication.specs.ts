import 'mocha';
import request from 'supertest';
import {assert} from 'chai';
import app from "../../src";
import {mockCredential} from "../utils";
import {SecurityUtil} from "../../src/utilities/security.util";

describe('HTTP Authentication', () => {
    let credential: any;

    it('generate credential', async () => {
        await app.knex.table('settings').where('slug', 'tta_req').update({value: '1'})

        credential = await mockCredential(app, 'customer', 'test_customer')
    });

    it('GET /api/v1/tfa/send', async () => {
        return request(app)
            .get('/api/v1/tfa/send')
            .set('Content-Type', 'application/json')
            .set('Authorization', `Bearer ${credential.authentication.token}`)
            .then(async (response: any) => {
                const code = await SecurityUtil().hash('123456')
                await app.knex.table('two_factor_authentications').where('id', response.body.id).update({code})

                assert.equal(response.status, 200);
            });
    });

    it('POST /api/v1/tfa/validate', async () => {
        return request(app)
            .post('/api/v1/tfa/validate')
            .send({
                code: '123456',
            })
            .set('Content-Type', 'application/json')
            .set('Authorization', `Bearer ${credential.authentication.token}`)
            .then(async (response: any) => {
                await app.knex.table('settings').where('slug', 'tta_req').update({value: '0'})
                assert.equal(response.status, 200);
            });
    });
});