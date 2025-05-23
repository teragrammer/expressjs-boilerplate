import 'mocha';
import request from 'supertest';
import {assert} from 'chai';
import app from "../../src";
import {mockCredential} from "../utils";
import {UserInterface} from "../../src/interfaces/user.interface";
import {SecurityUtil} from "../../src/utilities/security.util";

describe('HTTP Password Recovery', async () => {
    let credential: any;
    let user: UserInterface;

    it('generate credential', async () => {
        credential = await mockCredential(app, 'admin', 'test_admin')
        user = await app.knex.table('users').where('id', credential.user).first();
    });

    it('POST /api/v1/password-recovery/send', async () => {
        return request(app)
            .post('/api/v1/password-recovery/send')
            .send({
                to: 'email',
                email: user.email,
            })
            .set('Content-Type', 'application/json')
            .then(async (response: any) => {
                assert.equal(response.status, 200);
            });
    });

    it('POST /api/v1/password-recovery/send, failed', async () => {
        return request(app)
            .post('/api/v1/password-recovery/send')
            .send({
                to: 'email',
                email: user.email,
            })
            .set('Content-Type', 'application/json')
            .then(async (response: any) => {
                assert.equal(response.status, 400);
            });
    });

    it('POST /api/v1/password-recovery/validate, failed', async () => {
        return request(app)
            .post('/api/v1/password-recovery/validate')
            .send({
                to: 'email',
                email: user.email,
                code: '123456',
            })
            .set('Content-Type', 'application/json')
            .then(async (response: any) => {
                assert.equal(response.status, 400);
            });
    });

    it('POST /api/v1/password-recovery/validate', async () => {
        await app.knex.table('password_recoveries')
            .where('send_to', user.email)
            .update({
                code: await SecurityUtil().hash('123456'),
            });

        return request(app)
            .post('/api/v1/password-recovery/validate')
            .send({
                to: 'email',
                email: user.email,
                code: '123456',
            })
            .set('Content-Type', 'application/json')
            .then(async (response: any) => {
                assert.equal(response.status, 200);
            });
    });
});