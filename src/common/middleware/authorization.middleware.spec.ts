// src/common/middleware/authorization.middleware.spec.ts
import {beforeEach, describe, expect, it, vi} from "vitest";
import {NextFunction, Request, Response} from "express";

import {AuthorizationMiddleware} from "./authorization.middleware";
import {JwtExtendedPayload} from "../../modules/auth/authentication/authentication.interface";
import {User} from "../../modules/users/user.interface";
import {AuthenticationToken} from "../../modules/auth/authentication/authentication.interface";

const {
    mockGetCache,
} = vi.hoisted(() => ({
    mockGetCache: vi.fn(),
}));

vi.mock(
    "../../config/container",
    () => ({
        routeGuardService: {
            getCache: mockGetCache,
        },
    }),
);

describe("AuthorizationMiddleware", () => {
    let req: Partial<Request>;
    let res: Partial<Response>;
    let next: NextFunction;

    type TestJwtPayload = JwtExtendedPayload & {
        bpa?: number;
        rol?: string;
    };

    const invoke = async (
        route: string,
        isHalt = true,
    ) => {
        const middleware = AuthorizationMiddleware(
            route,
            isHalt,
        );

        return middleware(
            req as Request,
            res as Response,
            next,
        );
    };

    const expectJsonResponse = (
        statusCode: number,
        code: string,
    ) => {
        expect(res.status)
            .toHaveBeenCalledTimes(1);

        expect(res.status)
            .toHaveBeenCalledWith(statusCode);

        expect(res.json)
            .toHaveBeenCalledTimes(1);

        expect(res.json)
            .toHaveBeenCalledWith({
                code,
                message: expect.any(String),
            });

        expect(next)
            .not.toHaveBeenCalled();
    };

    const expectNext = () => {
        expect(next)
            .toHaveBeenCalledTimes(1);

        expect(next)
            .toHaveBeenCalledWith();

        expect(res.status)
            .not.toHaveBeenCalled();

        expect(res.json)
            .not.toHaveBeenCalled();
    };

    const setCredentials = (
        {
            bpa,
            role,
        }: {
            bpa?: number;
            role?: string;
        } = {},
    ) => {
        const jwt: TestJwtPayload = {
            uid: 1,
            tid: 1,
            tfa: false,
            bpa,
            rol: role,
        };

        req.credentials = {
            jwt,
            user: vi.fn<() => Promise<User>>(),
            authentication:
                vi.fn<() => Promise<AuthenticationToken>>(),
        };
    };

    const setRouteGuards = (
        guards: Record<string, string[]> | null | undefined,
    ) => {
        mockGetCache.mockResolvedValue(guards);
    };

    const setAuthorizedCredentials = (
        route: string,
        role = "administrator",
    ) => {
        setCredentials({
            bpa: 0,
            role,
        });

        setRouteGuards({
            [role]: [route],
        });
    };

    const expectForbidden = (
        code:
            | "AUTH_PERM_CACHE"
            | "AUTH_PERM_UNDEFINED"
            | "AUTH_PERM_UNAUTHORIZED",
    ) => {
        expectJsonResponse(403, code);
    };

    beforeEach(() => {
        vi.resetAllMocks();

        req = {
            credentials: undefined,
        };

        res = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn().mockReturnThis(),
        };

        next = vi.fn();
    });

    describe("authentication state", () => {
        it("should return 401 when credentials are missing and authorization is halted", async () => {
            await invoke("route-guards:browse");

            expectJsonResponse(
                401,
                "AUTH_PERM_EXPIRED",
            );

            expect(mockGetCache)
                .not.toHaveBeenCalled();
        });

        it("should call next when credentials are missing and authorization is not halted", async () => {
            await invoke(
                "route-guards:browse",
                false,
            );

            expectNext();

            expect(mockGetCache)
                .not.toHaveBeenCalled();
        });
    });

    describe("bypass authorization", () => {
        it("should bypass route guard checks when bpa is 1", async () => {
            setCredentials({
                bpa: 1,
                role: "administrator",
            });

            await invoke("route-guards:delete");

            expectNext();

            expect(mockGetCache)
                .not.toHaveBeenCalled();
        });

        it.each([
            0,
            undefined,
        ])(
            "should not bypass authorization when bpa is %s",
            async (bpa) => {
                setAuthorizedCredentials(
                    "route-guards:delete",
                );

                const credentials =
                    req.credentials!.jwt;

                credentials.bpa = bpa;

                await invoke(
                    "route-guards:delete",
                );

                expect(mockGetCache)
                    .toHaveBeenCalledTimes(1);

                expectNext();
            },
        );
    });

    describe("route guard cache", () => {
        it("should retrieve route guards from the service", async () => {
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

            await invoke(
                "route-guards:browse",
            );

            expect(mockGetCache)
                .toHaveBeenCalledTimes(1);

            expectNext();
        });

        it.each([
            null,
            undefined,
        ])(
            "should return 403 when the route guard cache is %s",
            async (guards) => {
                setCredentials({
                    bpa: 0,
                    role: "administrator",
                });

                setRouteGuards(guards);

                await invoke(
                    "route-guards:browse",
                );

                expectForbidden(
                    "AUTH_PERM_CACHE",
                );
            },
        );

        it.each([
            undefined,
            "",
        ])(
            "should return 403 when the role is %s",
            async (role) => {
                setCredentials({
                    bpa: 0,
                    role,
                });

                setRouteGuards({
                    administrator: [
                        "route-guards:browse",
                    ],
                });

                await invoke(
                    "route-guards:browse",
                );

                expectForbidden(
                    "AUTH_PERM_CACHE",
                );
            },
        );
    });

    describe("role authorization", () => {
        it("should call next when the user's role exists in the cache", async () => {
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

            await invoke(
                "route-guards:browse",
            );

            expectNext();
        });

        it("should return 403 when the user's role does not exist in the cache", async () => {
            setCredentials({
                bpa: 0,
                role: "administrator",
            });

            setRouteGuards({
                user: [
                    "route-guards:browse",
                ],
            });

            await invoke(
                "route-guards:browse",
            );

            expectForbidden(
                "AUTH_PERM_UNDEFINED",
            );
        });

        it("should return 403 when the role exists but has no routes", async () => {
            setCredentials({
                bpa: 0,
                role: "administrator",
            });

            setRouteGuards({
                administrator: [],
            });

            await invoke(
                "route-guards:browse",
            );

            expectForbidden(
                "AUTH_PERM_UNAUTHORIZED",
            );
        });

        it("should return 403 when the route is not assigned to the user's role", async () => {
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

            await invoke(
                "route-guards:delete",
            );

            expectForbidden(
                "AUTH_PERM_UNAUTHORIZED",
            );
        });

        it("should authorize the exact requested route", async () => {
            setAuthorizedCredentials(
                "route-guards:delete",
            );

            await invoke(
                "route-guards:delete",
            );

            expectNext();
        });

        it("should not treat a similar route as an authorized route", async () => {
            setAuthorizedCredentials(
                "route-guards:browse",
            );

            await invoke(
                "route-guards:browse/something",
            );

            expectForbidden(
                "AUTH_PERM_UNAUTHORIZED",
            );
        });

        it("should be case-sensitive when matching routes", async () => {
            setAuthorizedCredentials(
                "route-guards:browse",
            );

            await invoke(
                "ROUTE-GUARDS:BROWSE",
            );

            expectForbidden(
                "AUTH_PERM_UNAUTHORIZED",
            );
        });
    });

    describe("isHalt", () => {
        it("should skip authorization checks when isHalt is false", async () => {
            setCredentials({
                bpa: 0,
                role: "administrator",
            });

            await invoke(
                "route-guards:delete",
                false,
            );

            expectNext();

            expect(mockGetCache)
                .not.toHaveBeenCalled();
        });

        it("should call next when isHalt is explicitly false and credentials are missing", async () => {
            await invoke(
                "route-guards:delete",
                false,
            );

            expectNext();

            expect(mockGetCache)
                .not.toHaveBeenCalled();
        });

        it("should perform authorization when isHalt is explicitly true", async () => {
            setAuthorizedCredentials(
                "route-guards:browse",
            );

            await invoke(
                "route-guards:browse",
                true,
            );

            expect(mockGetCache)
                .toHaveBeenCalledTimes(1);

            expectNext();
        });
    });

    describe("cache errors", () => {
        it("should propagate an error when getCache rejects", async () => {
            setCredentials({
                bpa: 0,
                role: "administrator",
            });

            const cacheError = new Error(
                "Redis unavailable",
            );

            mockGetCache.mockRejectedValue(
                cacheError,
            );

            await expect(
                invoke("route-guards:browse"),
            ).rejects.toThrow(cacheError);

            expect(mockGetCache)
                .toHaveBeenCalledTimes(1);

            expect(next)
                .not.toHaveBeenCalled();

            expect(res.status)
                .not.toHaveBeenCalled();

            expect(res.json)
                .not.toHaveBeenCalled();
        });
    });

    describe("response consistency", () => {
        it("should use AUTH_PERM_EXPIRED for missing credentials", async () => {
            await invoke(
                "route-guards:browse",
            );

            expect(res.json)
                .toHaveBeenCalledWith({
                    code: "AUTH_PERM_EXPIRED",
                    message: expect.any(String),
                });
        });

        it("should use AUTH_PERM_CACHE when cache or role information is unavailable", async () => {
            setCredentials({
                bpa: 0,
            });

            setRouteGuards({});

            await invoke(
                "route-guards:browse",
            );

            expect(res.json)
                .toHaveBeenCalledWith({
                    code: "AUTH_PERM_CACHE",
                    message: expect.any(String),
                });
        });

        it("should use AUTH_PERM_UNDEFINED for an unknown role", async () => {
            setCredentials({
                bpa: 0,
                role: "unknown-role",
            });

            setRouteGuards({
                administrator: [
                    "route-guards:browse",
                ],
            });

            await invoke(
                "route-guards:browse",
            );

            expect(res.json)
                .toHaveBeenCalledWith({
                    code: "AUTH_PERM_UNDEFINED",
                    message: expect.any(String),
                });
        });

        it("should use AUTH_PERM_UNAUTHORIZED when the route is not allowed", async () => {
            setCredentials({
                bpa: 0,
                role: "administrator",
            });

            setRouteGuards({
                administrator: [
                    "route-guards:view",
                ],
            });

            await invoke(
                "route-guards:delete",
            );

            expect(res.json)
                .toHaveBeenCalledWith({
                    code: "AUTH_PERM_UNAUTHORIZED",
                    message: expect.any(String),
                });
        });
    });
});
