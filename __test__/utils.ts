import {RoleInterface} from "../src/interfaces/role.interface";
import {AuthenticationTokenModel} from "../src/models/authentication-token.model";
import {SecurityUtil} from "../src/utilities/security.util";
import {UserInterface} from "../src/interfaces/user.interface";
import {DBKnex} from "../src/connectors/databases/knex";
import {UserModel} from "../src/models/user.model";

export interface Options {
    role: string;
    username: string;
    tfa?: string;
}

export interface Credentials {
    user: UserInterface;
    token: string;
}

export async function mockCredential(options: Options): Promise<Credentials> {
    const tfa = options.tfa !== undefined ? options.tfa : "con";

    // remove previous test user
    await DBKnex.table("users").where("username", options.username).delete();

    const role: RoleInterface = await DBKnex.table("roles").where("slug", options.role).first();

    // create a new mock user
    const userId = await DBKnex.table("users").returning("id").insert({
        role_id: role.id,
        username: options.username,
        password: await SecurityUtil().hash("123456"),
        email: SecurityUtil().randomString(8) + "@gmail.com",
    });

    const user: UserInterface = await UserModel(DBKnex).profile(userId[0]);

    // generate a new token
    const token: string = await AuthenticationTokenModel(DBKnex).token(user, tfa);

    return {
        user,
        token,
    };
}