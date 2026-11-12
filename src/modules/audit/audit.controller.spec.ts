// src/modules/audit/audit.controller.spec.ts
import {beforeEach, describe, expect, it, vi} from "vitest";
import {NextFunction, Request, Response} from "express";

import {AuditController} from "./audit.controller";
import {AuditService} from "./audit.service";
import {AuditLogEntry} from "./audit.interface";
import Messages from "../../common/utils/messages";

const {mockBrowse} = vi.hoisted(() => ({
    mockBrowse: vi.fn(),
}));

vi.mock("../../common/utils/catch-async", () => ({
    default: (fn: any) => (req: any, res: any, next: any) =>
        Promise.resolve(fn(req, res, next)).catch(next),
}));

describe("AuditController", () => {
    let controller: AuditController;
    let req: Partial<Request>;
    let res: Partial<Response>;
    let next: NextFunction;

    const invoke = async () => {
        await controller.browse(
            req as Request,
            res as Response,
            next,
        );
    };

    const expectSuccessfulResponse = (
        data: unknown,
    ) => {
        expect(res.status).toHaveBeenCalledTimes(1);
        expect(res.status).toHaveBeenCalledWith(200);

        expect(res.json).toHaveBeenCalledTimes(1);
        expect(res.json).toHaveBeenCalledWith(data);

        expect(next).not.toHaveBeenCalled();
    };

    const expectErrorForwarded = (error: unknown) => {
        expect(next).toHaveBeenCalledTimes(1);
        expect(next).toHaveBeenCalledWith(error);

        expect(res.status).not.toHaveBeenCalled();
        expect(res.json).not.toHaveBeenCalled();
    };

    beforeEach(() => {
        vi.clearAllMocks();

        controller = new AuditController({
            browse: mockBrowse,
        } as unknown as AuditService);

        req = {query: {}};

        res = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn().mockReturnThis(),
        };

        next = vi.fn();
    });

    it("should use the default pagination and no filters", async () => {
        mockBrowse.mockResolvedValue({items: [], total: 0});

        await invoke();

        expect(mockBrowse).toHaveBeenCalledTimes(1);
        expect(mockBrowse).toHaveBeenCalledWith({
            actorUserId: undefined,
            action: undefined,
            outcome: undefined,
            page: 1,
            perPage: 20,
        });

        expectSuccessfulResponse({
            items: [],
            total: 0,
            page: 1,
            per_page: 20,
        });
    });

    it("should parse and forward every supported filter", async () => {
        const items: AuditLogEntry[] = [
            {
                id: "event-1",
                occurred_at: new Date("2026-01-01T00:00:00.000Z"),
                actor_user_id: 7,
                actor_type: "admin",
                action: "auth.login.succeeded",
                target_type: "user",
                target_id: "7",
                outcome: "success",
                request_id: "request-1",
                ip: "127.0.0.1",
                user_agent: "vitest",
                metadata: {},
            },
        ];

        req.query = {
            page: "2",
            per_page: "50",
            actor_user_id: "7",
            action: "auth.login.succeeded",
            outcome: "success",
        };

        mockBrowse.mockResolvedValue({items, total: 51});

        await invoke();

        expect(mockBrowse).toHaveBeenCalledTimes(1);
        expect(mockBrowse).toHaveBeenCalledWith({
            actorUserId: 7,
            action: "auth.login.succeeded",
            outcome: "success",
            page: 2,
            perPage: 50,
        });

        expectSuccessfulResponse({
            items,
            total: 51,
            page: 2,
            per_page: 50,
        });
    });

    it("should clamp the page and per-page values to their allowed range", async () => {
        req.query = {
            page: "-3",
            per_page: "1000",
        };

        mockBrowse.mockResolvedValue({items: [], total: 0});

        await invoke();

        expect(mockBrowse).toHaveBeenCalledWith({
            actorUserId: undefined,
            action: undefined,
            outcome: undefined,
            page: 1,
            perPage: 100,
        });

        expectSuccessfulResponse({
            items: [],
            total: 0,
            page: 1,
            per_page: 100,
        });
    });

    it("should fall back to the per-page default for non-numeric input", async () => {
        req.query = {
            page: "not-a-number",
            per_page: "not-a-number",
        };

        mockBrowse.mockResolvedValue({items: [], total: 0});

        await invoke();

        expect(mockBrowse).toHaveBeenCalledWith({
            actorUserId: undefined,
            action: undefined,
            outcome: undefined,
            page: 1,
            perPage: 20,
        });

        expectSuccessfulResponse({
            items: [],
            total: 0,
            page: 1,
            per_page: 20,
        });
    });

    it("should treat empty filters as absent", async () => {
        req.query = {
            actor_user_id: "",
            action: "",
            outcome: "",
        };

        mockBrowse.mockResolvedValue({items: [], total: 0});

        await invoke();

        expect(mockBrowse).toHaveBeenCalledWith({
            actorUserId: undefined,
            action: undefined,
            outcome: undefined,
            page: 1,
            perPage: 20,
        });

        expectSuccessfulResponse({
            items: [],
            total: 0,
            page: 1,
            per_page: 20,
        });
    });

    it("should reject an actor user id that is not a safe integer", async () => {
        req.query = {
            actor_user_id: "not-a-number",
        };

        await invoke();

        expect(mockBrowse).not.toHaveBeenCalled();

        expectErrorForwarded(
            expect.objectContaining({
                message: Messages.INVALID_PATH_PARAM.message,
                errorCode: Messages.INVALID_PATH_PARAM.code,
                statusCode: Messages.INVALID_PATH_PARAM.status,
            }),
        );
    });

    it("should reject a fractional actor user id", async () => {
        req.query = {
            actor_user_id: "1.5",
        };

        await invoke();

        expect(mockBrowse).not.toHaveBeenCalled();

        expectErrorForwarded(
            expect.objectContaining({
                message: Messages.INVALID_PATH_PARAM.message,
                errorCode: Messages.INVALID_PATH_PARAM.code,
                statusCode: Messages.INVALID_PATH_PARAM.status,
            }),
        );
    });

    it("should forward service errors to the next middleware", async () => {
        const serviceError = new Error("Failed to browse audit events");

        mockBrowse.mockRejectedValue(serviceError);

        await invoke();

        expect(mockBrowse).toHaveBeenCalledTimes(1);
        expectErrorForwarded(serviceError);
    });
});
