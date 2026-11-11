"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveActor = resolveActor;
const request_credentials_1 = require("./request-credentials");
/**
 * Builds the authorization actor from the request credentials.
 *
 * The role slug and the bypass flag come from the access token, which
 * is bound to a live session and re-validated against the user's
 * authorization version on every request.
 */
function resolveActor(req) {
    var _a;
    (0, request_credentials_1.assertCredentials)(req);
    const { jwt } = req.credentials;
    return {
        id: jwt.uid,
        roleSlug: (_a = jwt.rol) !== null && _a !== void 0 ? _a : "",
        bypass: jwt.bpa === 1,
    };
}
