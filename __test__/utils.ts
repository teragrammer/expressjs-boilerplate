import {RoleInterface} from "../src/interfaces/role.interface";
import {UserInterface} from "../src/interfaces/user.interface";
import UserRepository from "../src/repositories/user.repository";
import AuthenticationTokenService from "../src/services/data/authentication-token.service";
import {UserModel} from "../src/models/user.model";
import {RoleModel} from "../src/models/role.model";
import {SecurityUtil} from "../src/utilities/security.util";
import {TFA_HOLD} from "../src/models/two-factor-authentication.model";

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
    const tfa = options.tfa !== undefined ? options.tfa : TFA_HOLD;

    // remove previous test user
    await UserModel().table().where("username", options.username).delete();

    const ROLE: RoleInterface = await RoleModel().table().where("slug", options.role).first();

    // create a new mock user
    const [ID] = await UserModel().table().returning("id").insert({
        role_id: ROLE.id,
        username: options.username,
        password: await SecurityUtil().hash("123456"),
        email: SecurityUtil().randomString(8) + "@gmail.com",
    });

    // get the full details
    const user: UserInterface = await UserRepository.byId(ID);

    // generate a new token
    const token: string = await AuthenticationTokenService.token(user, tfa);

    return {
        user,
        token,
    };
}