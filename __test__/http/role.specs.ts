import 'mocha';
import request from 'supertest';
import {assert} from 'chai';
import app from "../../src";
import {mockCredential} from "../utils";
import {RoleInterface} from "../../src/interfaces/role.interface";

describe('HTTP Account', async () => {
    let credential: any;
    let id: any;

    it('generate credential', async () => {
        credential = await mockCredential(app, 'admin', 'test_admin')
    });

    it('POST /api/v1/roles', async () => {
        return request(app)
            .post('/api/v1/roles')
            .send({
                name: 'Test',
                slug: 'test',
                is_public: '1'
            })
            .set('Content-Type', 'application/json')
            .set('Authorization', `Bearer ${credential.authentication.token}`)
            .then(async (response: any) => {
                id = response.body.id;
                assert.equal(response.status, 200);
            });
    });

    it('PUT /api/v1/roles/:id', async () => {
        const newName = 'New Test'
        return request(app)
            .put(`/api/v1/roles/${id}`)
            .send({
                name: newName,
                slug: 'test',
                is_public: '1'
            })
            .set('Content-Type', 'application/json')
            .set('Authorization', `Bearer ${credential.authentication.token}`)
            .then(async (response: any) => {
                const role: RoleInterface = await app.knex.table('roles').where('id', id).first();

                assert.equal(response.status, 200);
                assert.equal(role.name, newName)
            });
    });

    it('GET /api/v1/roles', async () => {
        return request(app)
            .get('/api/v1/roles')
            .query({
                search: 'test'
            })
            .set('Content-Type', 'application/json')
            .set('Authorization', `Bearer ${credential.authentication.token}`)
            .then(async (response: any) => {
                assert.equal(response.status, 200);
            });
    });

    it('GET /api/v1/roles/:id', async () => {
        return request(app)
            .get(`/api/v1/roles/${id}`)
            .set('Content-Type', 'application/json')
            .set('Authorization', `Bearer ${credential.authentication.token}`)
            .then(async (response: any) => {
                assert.equal(response.status, 200);
                assert.equal(response.body.slug, 'test')
            });
    });

    it('DELETE /api/v1/roles/:id', async () => {
        return request(app)
            .delete(`/api/v1/roles/${id}`)
            .set('Content-Type', 'application/json')
            .set('Authorization', `Bearer ${credential.authentication.token}`)
            .then(async (response: any) => {
                assert.equal(response.status, 200);
            });
    });
});