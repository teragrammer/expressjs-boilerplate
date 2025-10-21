import {Express} from "express";
import {RoleInterface} from "../src/interfaces/role.interface";
import {AuthenticationTokenModel} from "../src/models/authentication-token.model";
import {SecurityUtil} from "../src/utilities/security.util";
import {UserInterface} from "../src/interfaces/user.interface";
import {DatabaseMiddleware} from "../src/http/middlewares/database.middleware";

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
    await DatabaseMiddleware().table("users").where("username", options.username).delete();

    const role: RoleInterface = await DatabaseMiddleware().table("roles").where("slug", options.role).first();

    const data = {
        role_id: role.id,
        username: options.username,
        password: await SecurityUtil().hash("123456"),
        email: SecurityUtil().randomString(8) + "@gmail.com",
    };

    const userId = await DatabaseMiddleware().table("users").returning("id").insert(data);
    const user: UserInterface = await DatabaseMiddleware().table("users").where("id", userId[0]).first();
    user.role = await DatabaseMiddleware().table("roles").where("id", user.role_id).first();

    const token: string = await AuthenticationTokenModel(DatabaseMiddleware()).token(user, tfa);

    return {
        user,
        token,
    };
}