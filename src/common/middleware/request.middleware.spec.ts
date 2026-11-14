import {beforeEach, describe, expect, it, vi} from "vitest";
import {NextFunction, Request, Response} from "express";
import requestHandler from "./request.middleware";

describe("Request Middleware", () => {
    let mockRequest: Partial<Request>;
    let mockResponse: Partial<Response>;
    let nextFunction: NextFunction;

    beforeEach(() => {
        mockRequest = {
            body: {},
            query: {},
        };

        mockResponse = {};

        nextFunction = vi.fn();
    });

    describe("Safe Pagination Calculations", () => {
        it("should compute offset, perPage and page when query params are valid strings", async () => {
            mockRequest.query = {
                page: "3",
                per_page: "20",
            };

            await requestHandler(
                mockRequest as Request,
                mockResponse as Response,
                nextFunction
            );

            expect(mockRequest.pagination).toEqual({
                page: 3,
                offset: 40, // (3 - 1) * 20
                perPage: 20,
            });
        });

        it("should use default values when pagination parameters are missing or invalid", async () => {
            mockRequest.query = {
                page: "invalid",
                per_page: "invalid",
            };

            await requestHandler(
                mockRequest as Request,
                mockResponse as Response,
                nextFunction
            );

            expect(mockRequest.pagination).toEqual({
                page: 1,
                offset: 0, // (1 - 1) * 10
                perPage: 10,
            });
        });

        it("should enforce minimum page of 1", async () => {
            mockRequest.query = {
                page: "0",
                per_page: "20",
            };

            await requestHandler(
                mockRequest as Request,
                mockResponse as Response,
                nextFunction
            );

            expect(mockRequest.pagination).toEqual({
                page: 1,
                offset: 0,
                perPage: 20,
            });
        });

        it("should enforce minimum perPage of 1", async () => {
            mockRequest.query = {
                page: "2",
                per_page: "0",
            };

            await requestHandler(
                mockRequest as Request,
                mockResponse as Response,
                nextFunction
            );

            expect(mockRequest.pagination).toEqual({
                page: 2,
                offset: 1,
                perPage: 1,
            });
        });

        it("should enforce maximum perPage of 100", async () => {
            mockRequest.query = {
                page: "2",
                per_page: "500",
            };

            await requestHandler(
                mockRequest as Request,
                mockResponse as Response,
                nextFunction
            );

            expect(mockRequest.pagination).toEqual({
                page: 2,
                offset: 100,
                perPage: 100,
            });
        });

        it("should floor decimal pagination values", async () => {
            mockRequest.query = {
                page: "2.9",
                per_page: "10.8",
            };

            await requestHandler(
                mockRequest as Request,
                mockResponse as Response,
                nextFunction
            );

            expect(mockRequest.pagination).toEqual({
                page: 2,
                offset: 10,
                perPage: 10,
            });
        });
    });

    describe("Cursor Pagination", () => {
        it("should compute cursor pagination when cursor is a valid string", async () => {
            mockRequest.query = {
                cursor: "123",
                per_page: "20",
            };

            await requestHandler(
                mockRequest as Request,
                mockResponse as Response,
                nextFunction
            );

            expect(mockRequest.cursorPagination).toEqual({
                cursor: 123,
                perPage: 20,
            });
        });

        it("should floor decimal cursor values", async () => {
            mockRequest.query = {
                cursor: "123.99",
                per_page: "20",
            };

            await requestHandler(
                mockRequest as Request,
                mockResponse as Response,
                nextFunction
            );

            expect(mockRequest.cursorPagination).toEqual({
                cursor: 123,
                perPage: 20,
            });
        });

        it("should set cursor to undefined when cursor is missing", async () => {
            mockRequest.query = {
                per_page: "20",
            };

            await requestHandler(
                mockRequest as Request,
                mockResponse as Response,
                nextFunction
            );

            expect(mockRequest.cursorPagination).toEqual({
                cursor: undefined,
                perPage: 20,
            });
        });

        it("should set cursor to undefined when cursor is invalid", async () => {
            mockRequest.query = {
                cursor: "invalid",
                per_page: "20",
            };

            await requestHandler(
                mockRequest as Request,
                mockResponse as Response,
                nextFunction
            );

            expect(mockRequest.cursorPagination).toEqual({
                cursor: undefined,
                perPage: 20,
            });
        });

        it("should set cursor to undefined when cursor is zero", async () => {
            mockRequest.query = {
                cursor: "0",
                per_page: "20",
            };

            await requestHandler(
                mockRequest as Request,
                mockResponse as Response,
                nextFunction
            );

            expect(mockRequest.cursorPagination).toEqual({
                cursor: undefined,
                perPage: 20,
            });
        });

        it("should set cursor to undefined when cursor is negative", async () => {
            mockRequest.query = {
                cursor: "-10",
                per_page: "20",
            };

            await requestHandler(
                mockRequest as Request,
                mockResponse as Response,
                nextFunction
            );

            expect(mockRequest.cursorPagination).toEqual({
                cursor: undefined,
                perPage: 20,
            });
        });

        it("should use the same validated perPage for cursor pagination", async () => {
            mockRequest.query = {
                cursor: "100",
                per_page: "500",
            };

            await requestHandler(
                mockRequest as Request,
                mockResponse as Response,
                nextFunction
            );

            expect(mockRequest.cursorPagination).toEqual({
                cursor: 100,
                perPage: 100,
            });
        });

        it("should use default perPage when per_page is missing", async () => {
            mockRequest.query = {
                cursor: "100",
            };

            await requestHandler(
                mockRequest as Request,
                mockResponse as Response,
                nextFunction
            );

            expect(mockRequest.cursorPagination).toEqual({
                cursor: 100,
                perPage: 10,
            });
        });
    });

    describe("Secret sanitisation", () => {
        it("should preserve passwords exactly as supplied", async () => {
            mockRequest.body = {
                password: "  Pa<script>ss</script>word!  ",
                current_password: " old ",
                new_password: " new ",
            };

            await requestHandler(
                mockRequest as Request,
                mockResponse as Response,
                nextFunction
            );

            expect(mockRequest.sanitize!.body.get("password")).toBe(
                "  Pa<script>ss</script>word!  "
            );
            expect(mockRequest.sanitize!.body.get("current_password")).toBe(
                " old "
            );
            expect(mockRequest.sanitize!.body.get("new_password")).toBe(
                " new "
            );
        });

        it("should still strip markup from display fields", async () => {
            mockRequest.body = {
                first_name: "  <b>John</b>  ",
            };

            await requestHandler(
                mockRequest as Request,
                mockResponse as Response,
                nextFunction
            );

            expect(mockRequest.sanitize!.body.get("first_name")).toBe(
                "John"
            );
        });
    });

    describe("Middleware", () => {
        it("should call next", async () => {
            await requestHandler(
                mockRequest as Request,
                mockResponse as Response,
                nextFunction
            );

            expect(nextFunction).toHaveBeenCalledTimes(1);
        });
    });
});
