import {Express} from "express";
import {RoleInterface} from "../src/interfaces/role.interface";
import {AuthenticationTokenModel} from "../src/models/authentication-token.model";
import {SecurityUtil} from "../src/utilities/security.util";

export async function mockCredential(app: Express, slug: string, username: string) {
    await app.knex.table('users').where('username', username).delete();

    const role: RoleInterface = await app.knex.table('roles').where('slug', slug).first();
    const password = await SecurityUtil().hash('123456');

    const user = await app.knex.table('users').returning("id")
        .insert({role_id: role.id, username, password, email: SecurityUtil().randomString(8) + '@gmail.com'});
    const authentication = await AuthenticationTokenModel(app.knex).token(user[0]);

    return {
        user: user[0],
        authentication,
    }
}