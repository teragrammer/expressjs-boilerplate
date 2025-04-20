import 'mocha';
import request from 'supertest';
import {assert} from 'chai';
import app from "../../src";

describe('HTTP Authentication', () => {
    let token: string;

    it('POST /api/v1/register', async () => {
        await app.knex.table('users').where('username', 'test').delete();

        return request(app)
            .post('/api/v1/register')
            .send({
                first_name: "Test First Name",
                last_name: "Test Last Name",
                username: "test",
                password: "123456",
                email: "test@test.com",
            })
            .set('Content-Type', 'application/json')
            .then((response: any) => {
                token = response.body.credential.token;
                assert.equal(response.status, 200);
            });
    });

    it('POST /api/v1/login', async () => {
        return request(app)
            .post('/api/v1/login')
            .send({
                username: "test",
                password: "123456"
            })
            .set('Content-Type', 'application/json')
            .then((response: any) => {
                token = response.body.credential.token;
                assert.equal(response.status, 200);
            });
    });

    it('POST /api/v1/login (error)', async () => {
        return request(app)
            .post('/api/v1/login')
            .send({
                username: "test",
                password: "abc"
            })
            .set('Content-Type', 'application/json')
            .then((response: any) => {
                assert.equal(response.status, 403);
            });
    });

    it('GET /api/v1/logout', async () => {
        return request(app)
            .get('/api/v1/logout')
            .set('Content-Type', 'application/json')
            .set('Authorization', `Bearer ${token}`)
            .then((response: any) => {
                assert.equal(response.status, 200);
            });
    });
})