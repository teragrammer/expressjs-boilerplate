"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/common/middleware/authorization.middleware.spec.ts
const vitest_1 = require("vitest");
const authorization_middleware_1 = require("./authorization.middleware");
const { mockGetCache, } = vitest_1.vi.hoisted(() => ({
    mockGetCache: vitest_1.vi.fn(),
}));
vitest_1.vi.mock("../../config/container", () => ({
    routeGuardService: {
        getCache: mockGetCache,
    },
}));
(0, vitest_1.describe)("AuthorizationMiddleware", () => {
    let req;
    let res;
    let next;
    const invoke = (route_1, ...args_1) => __awaiter(void 0, [route_1, ...args_1], void 0, function* (route, isHalt = true) {
        const middleware = (0, authorization_middleware_1.AuthorizationMiddleware)(route, isHalt);
        return middleware(req, res, next);
    });
    const expectJsonResponse = (statusCode, code) => {
        (0, vitest_1.expect)(res.status)
            .toHaveBeenCalledTimes(1);
        (0, vitest_1.expect)(res.status)
            .toHaveBeenCalledWith(statusCode);
        (0, vitest_1.expect)(res.json)
            .toHaveBeenCalledTimes(1);
        (0, vitest_1.expect)(res.json)
            .toHaveBeenCalledWith({
            code,
            message: vitest_1.expect.any(String),
        });
        (0, vitest_1.expect)(next)
            .not.toHaveBeenCalled();
    };
    const expectNext = () => {
        (0, vitest_1.expect)(next)
            .toHaveBeenCalledTimes(1);
        (0, vitest_1.expect)(next)
            .toHaveBeenCalledWith();
        (0, vitest_1.expect)(res.status)
            .not.toHaveBeenCalled();
        (0, vitest_1.expect)(res.json)
            .not.toHaveBeenCalled();
    };
    const setCredentials = ({ bpa, role, } = {}) => {
        const jwt = {
            uid: 1,
            tid: 1,
            tfa: false,
            bpa,
            rol: role,
        };
        req.credentials = {
            jwt,
            user: vitest_1.vi.fn(),
            authentication: vitest_1.vi.fn(),
        };
    };
    const setRouteGuards = (guards) => {
        mockGetCache.mockResolvedValue(guards);
    };
    const setAuthorizedCredentials = (route, role = "administrator") => {
        setCredentials({
            bpa: 0,
            role,
        });
        setRouteGuards({
            [role]: [route],
        });
    };
    const expectForbidden = (code) => {
        expectJsonResponse(403, code);
    };
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.resetAllMocks();
        req = {
            credentials: undefined,
        };
        res = {
            status: vitest_1.vi.fn().mockReturnThis(),
            json: vitest_1.vi.fn().mockReturnThis(),
        };
        next = vitest_1.vi.fn();
    });
    (0, vitest_1.describe)("authentication state", () => {
        (0, vitest_1.it)("should return 401 when credentials are missing and authorization is halted", () => __awaiter(void 0, void 0, void 0, function* () {
            yield invoke("route-guards:browse");
            expectJsonResponse(401, "AUTH_PERM_EXPIRED");
            (0, vitest_1.expect)(mockGetCache)
                .not.toHaveBeenCalled();
        }));
        (0, vitest_1.it)("should call next when credentials are missing and authorization is not halted", () => __awaiter(void 0, void 0, void 0, function* () {
            yield invoke("route-guards:browse", false);
            expectNext();
            (0, vitest_1.expect)(mockGetCache)
                .not.toHaveBeenCalled();
        }));
    });
    (0, vitest_1.describe)("bypass authorization", () => {
        (0, vitest_1.it)("should bypass route guard checks when bpa is 1", () => __awaiter(void 0, void 0, void 0, function* () {
            setCredentials({
                bpa: 1,
                role: "administrator",
            });
            yield invoke("route-guards:delete");
            expectNext();
            (0, vitest_1.expect)(mockGetCache)
                .not.toHaveBeenCalled();
        }));
        vitest_1.it.each([
            0,
            undefined,
        ])("should not bypass authorization when bpa is %s", (bpa) => __awaiter(void 0, void 0, void 0, function* () {
            setAuthorizedCredentials("route-guards:delete");
            const credentials = req.credentials.jwt;
            credentials.bpa = bpa;
            yield invoke("route-guards:delete");
            (0, vitest_1.expect)(mockGetCache)
                .toHaveBeenCalledTimes(1);
            expectNext();
        }));
    });
    (0, vitest_1.describe)("route guard cache", () => {
        (0, vitest_1.it)("should retrieve route guards from the service", () => __awaiter(void 0, void 0, void 0, function* () {
            const guards = {
                administrator: [
                    "route-guards:create",
                    "route-guards:browse",
                    "route-guards:view",
                    "route-guards:delete",
                ],
            };
            setCredentials({
                bpa: 0,
                role: "administrator",
            });
            setRouteGuards(guards);
            yield invoke("route-guards:browse");
            (0, vitest_1.expect)(mockGetCache)
                .toHaveBeenCalledTimes(1);
            expectNext();
        }));
        vitest_1.it.each([
            null,
            undefined,
        ])("should return 403 when the route guard cache is %s", (guards) => __awaiter(void 0, void 0, void 0, function* () {
            setCredentials({
                bpa: 0,
                role: "administrator",
            });
            setRouteGuards(guards);
            yield invoke("route-guards:browse");
            expectForbidden("AUTH_PERM_CACHE");
        }));
        vitest_1.it.each([
            undefined,
            "",
        ])("should return 403 when the role is %s", (role) => __awaiter(void 0, void 0, void 0, function* () {
            setCredentials({
                bpa: 0,
                role,
            });
            setRouteGuards({
                administrator: [
                    "route-guards:browse",
                ],
            });
            yield invoke("route-guards:browse");
            expectForbidden("AUTH_PERM_CACHE");
        }));
    });
    (0, vitest_1.describe)("role authorization", () => {
        (0, vitest_1.it)("should call next when the user's role exists in the cache", () => __awaiter(void 0, void 0, void 0, function* () {
            setCredentials({
                bpa: 0,
                role: "administrator",
            });
            setRouteGuards({
                administrator: [
                    "route-guards:create",
                    "route-guards:browse",
                ],
            });
            yield invoke("route-guards:browse");
            expectNext();
        }));
        (0, vitest_1.it)("should return 403 when the user's role does not exist in the cache", () => __awaiter(void 0, void 0, void 0, function* () {
            setCredentials({
                bpa: 0,
                role: "administrator",
            });
            setRouteGuards({
                user: [
                    "route-guards:browse",
                ],
            });
            yield invoke("route-guards:browse");
            expectForbidden("AUTH_PERM_UNDEFINED");
        }));
        (0, vitest_1.it)("should return 403 when the role exists but has no routes", () => __awaiter(void 0, void 0, void 0, function* () {
            setCredentials({
                bpa: 0,
                role: "administrator",
            });
            setRouteGuards({
                administrator: [],
            });
            yield invoke("route-guards:browse");
            expectForbidden("AUTH_PERM_UNAUTHORIZED");
        }));
        (0, vitest_1.it)("should return 403 when the route is not assigned to the user's role", () => __awaiter(void 0, void 0, void 0, function* () {
            setCredentials({
                bpa: 0,
                role: "administrator",
            });
            setRouteGuards({
                administrator: [
                    "route-guards:create",
                    "route-guards:view",
                ],
            });
            yield invoke("route-guards:delete");
            expectForbidden("AUTH_PERM_UNAUTHORIZED");
        }));
        (0, vitest_1.it)("should authorize the exact requested route", () => __awaiter(void 0, void 0, void 0, function* () {
            setAuthorizedCredentials("route-guards:delete");
            yield invoke("route-guards:delete");
            expectNext();
        }));
        (0, vitest_1.it)("should not treat a similar route as an authorized route", () => __awaiter(void 0, void 0, void 0, function* () {
            setAuthorizedCredentials("route-guards:browse");
            yield invoke("route-guards:browse/something");
            expectForbidden("AUTH_PERM_UNAUTHORIZED");
        }));
        (0, vitest_1.it)("should be case-sensitive when matching routes", () => __awaiter(void 0, void 0, void 0, function* () {
            setAuthorizedCredentials("route-guards:browse");
            yield invoke("ROUTE-GUARDS:BROWSE");
            expectForbidden("AUTH_PERM_UNAUTHORIZED");
        }));
    });
    (0, vitest_1.describe)("isHalt", () => {
        (0, vitest_1.it)("should skip authorization checks when isHalt is false", () => __awaiter(void 0, void 0, void 0, function* () {
            setCredentials({
                bpa: 0,
                role: "administrator",
            });
            yield invoke("route-guards:delete", false);
            expectNext();
            (0, vitest_1.expect)(mockGetCache)
                .not.toHaveBeenCalled();
        }));
        (0, vitest_1.it)("should call next when isHalt is explicitly false and credentials are missing", () => __awaiter(void 0, void 0, void 0, function* () {
            yield invoke("route-guards:delete", false);
            expectNext();
            (0, vitest_1.expect)(mockGetCache)
                .not.toHaveBeenCalled();
        }));
        (0, vitest_1.it)("should perform authorization when isHalt is explicitly true", () => __awaiter(void 0, void 0, void 0, function* () {
            setAuthorizedCredentials("route-guards:browse");
            yield invoke("route-guards:browse", true);
            (0, vitest_1.expect)(mockGetCache)
                .toHaveBeenCalledTimes(1);
            expectNext();
        }));
    });
    (0, vitest_1.describe)("cache errors", () => {
        (0, vitest_1.it)("should propagate an error when getCache rejects", () => __awaiter(void 0, void 0, void 0, function* () {
            setCredentials({
                bpa: 0,
                role: "administrator",
            });
            const cacheError = new Error("Redis unavailable");
            mockGetCache.mockRejectedValue(cacheError);
            yield (0, vitest_1.expect)(invoke("route-guards:browse")).rejects.toThrow(cacheError);
            (0, vitest_1.expect)(mockGetCache)
                .toHaveBeenCalledTimes(1);
            (0, vitest_1.expect)(next)
                .not.toHaveBeenCalled();
            (0, vitest_1.expect)(res.status)
                .not.toHaveBeenCalled();
            (0, vitest_1.expect)(res.json)
                .not.toHaveBeenCalled();
        }));
    });
    (0, vitest_1.describe)("response consistency", () => {
        (0, vitest_1.it)("should use AUTH_PERM_EXPIRED for missing credentials", () => __awaiter(void 0, void 0, void 0, function* () {
            yield invoke("route-guards:browse");
            (0, vitest_1.expect)(res.json)
                .toHaveBeenCalledWith({
                code: "AUTH_PERM_EXPIRED",
                message: vitest_1.expect.any(String),
            });
        }));
        (0, vitest_1.it)("should use AUTH_PERM_CACHE when cache or role information is unavailable", () => __awaiter(void 0, void 0, void 0, function* () {
            setCredentials({
                bpa: 0,
            });
            setRouteGuards({});
            yield invoke("route-guards:browse");
            (0, vitest_1.expect)(res.json)
                .toHaveBeenCalledWith({
                code: "AUTH_PERM_CACHE",
                message: vitest_1.expect.any(String),
            });
        }));
        (0, vitest_1.it)("should use AUTH_PERM_UNDEFINED for an unknown role", () => __awaiter(void 0, void 0, void 0, function* () {
            setCredentials({
                bpa: 0,
                role: "unknown-role",
            });
            setRouteGuards({
                administrator: [
                    "route-guards:browse",
                ],
            });
            yield invoke("route-guards:browse");
            (0, vitest_1.expect)(res.json)
                .toHaveBeenCalledWith({
                code: "AUTH_PERM_UNDEFINED",
                message: vitest_1.expect.any(String),
            });
        }));
        (0, vitest_1.it)("should use AUTH_PERM_UNAUTHORIZED when the route is not allowed", () => __awaiter(void 0, void 0, void 0, function* () {
            setCredentials({
                bpa: 0,
                role: "administrator",
            });
            setRouteGuards({
                administrator: [
                    "route-guards:view",
                ],
            });
            yield invoke("route-guards:delete");
            (0, vitest_1.expect)(res.json)
                .toHaveBeenCalledWith({
                code: "AUTH_PERM_UNAUTHORIZED",
                message: vitest_1.expect.any(String),
            });
        }));
    });
});
