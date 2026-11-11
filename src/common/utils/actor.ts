// src/common/utils/actor.ts
import {Request} from "express";
import {Actor} from "../authz/policy";
import {assertCredentials} from "./request-credentials";

/**
 * Builds the authorization actor from the request credentials.
 *
 * The role slug and the bypass flag come from the access token, which
 * is bound to a live session and re-validated against the user's
 * authorization version on every request.
 */
export function resolveActor(req: Request): Actor {
    assertCredentials(req);

    const {jwt} = req.credentials;

    return {
        id: jwt.uid,
        roleSlug: jwt.rol ?? "",
        bypass: jwt.bpa === 1,
    };
}
