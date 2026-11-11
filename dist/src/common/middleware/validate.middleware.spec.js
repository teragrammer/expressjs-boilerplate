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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/common/middleware/validate.middleware.spec.ts
const vitest_1 = require("vitest");
const joi_1 = __importDefault(require("joi"));
const validate_middleware_1 = require("./validate.middleware");
(0, vitest_1.describe)("validate middleware", () => {
    let req;
    let res;
    let next;
    const getNextError = () => {
        var _a;
        const mock = next;
        return (_a = mock.mock.calls[0]) === null || _a === void 0 ? void 0 : _a[0];
    };
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.clearAllMocks();
        req = {
            sanitize: {
                body: {
                    get: vitest_1.vi.fn(),
                    only: vitest_1.vi.fn(),
                    numeric: vitest_1.vi.fn(),
                },
                query: {
                    get: vitest_1.vi.fn(),
                    only: vitest_1.vi.fn(),
                    numeric: vitest_1.vi.fn(),
                },
                data: undefined,
            },
        };
        res = {};
        next = vitest_1.vi.fn();
    });
    (0, vitest_1.describe)("successful validation", () => {
        (0, vitest_1.it)("should sanitize, validate, store data, and call next", () => __awaiter(void 0, void 0, void 0, function* () {
            const schema = joi_1.default.object({
                username: joi_1.default.string().required(),
                password: joi_1.default.string().min(8).required(),
            });
            const input = {
                username: "testuser",
                password: "password123",
            };
            req.sanitize.body.only.mockReturnValue(input);
            const middleware = (0, validate_middleware_1.validate)(schema, ["username", "password"]);
            yield middleware(req, res, next);
            (0, vitest_1.expect)(req.sanitize.body.only).toHaveBeenCalledOnce();
            (0, vitest_1.expect)(req.sanitize.body.only).toHaveBeenCalledWith([
                "username",
                "password",
            ]);
            (0, vitest_1.expect)(req.sanitize.data).toEqual(input);
            (0, vitest_1.expect)(next).toHaveBeenCalledOnce();
            (0, vitest_1.expect)(next).toHaveBeenCalledWith();
        }));
        (0, vitest_1.it)("should store the transformed value returned by Joi", () => __awaiter(void 0, void 0, void 0, function* () {
            const schema = joi_1.default.object({
                username: joi_1.default.string().trim().required(),
                password: joi_1.default.string().required(),
            });
            const input = {
                username: "  testuser  ",
                password: "password123",
            };
            req.sanitize.body.only.mockReturnValue(input);
            const middleware = (0, validate_middleware_1.validate)(schema, ["username", "password"]);
            yield middleware(req, res, next);
            (0, vitest_1.expect)(req.sanitize.data).toEqual({
                username: "testuser",
                password: "password123",
            });
            (0, vitest_1.expect)(req.sanitize.data).not.toBe(input);
            (0, vitest_1.expect)(next).toHaveBeenCalledOnce();
            (0, vitest_1.expect)(next).toHaveBeenCalledWith();
        }));
        (0, vitest_1.it)("should pass only the requested fields to the sanitizer", () => __awaiter(void 0, void 0, void 0, function* () {
            const schema = joi_1.default.object({
                username: joi_1.default.string().required(),
                password: joi_1.default.string().required(),
            });
            const sanitizedData = {
                username: "testuser",
                password: "password123",
            };
            req.sanitize.body.only.mockReturnValue(sanitizedData);
            const middleware = (0, validate_middleware_1.validate)(schema, ["username", "password"]);
            yield middleware(req, res, next);
            (0, vitest_1.expect)(req.sanitize.body.only).toHaveBeenCalledOnce();
            (0, vitest_1.expect)(req.sanitize.body.only).toHaveBeenCalledWith([
                "username",
                "password",
            ]);
            (0, vitest_1.expect)(req.sanitize.data).toEqual(sanitizedData);
            (0, vitest_1.expect)(next).toHaveBeenCalledOnce();
            (0, vitest_1.expect)(next).toHaveBeenCalledWith();
        }));
    });
    (0, vitest_1.describe)("validation failures", () => {
        (0, vitest_1.it)("should forward Joi validation errors to next", () => __awaiter(void 0, void 0, void 0, function* () {
            const schema = joi_1.default.object({
                username: joi_1.default.string().required(),
                password: joi_1.default.string().required(),
            });
            req.sanitize.body.only.mockReturnValue({
                username: "testuser",
            });
            const middleware = (0, validate_middleware_1.validate)(schema, ["username", "password"]);
            yield middleware(req, res, next);
            (0, vitest_1.expect)(next).toHaveBeenCalledOnce();
            const error = getNextError();
            (0, vitest_1.expect)(error).toBeInstanceOf(joi_1.default.ValidationError);
            (0, vitest_1.expect)(error).toMatchObject({
                message: '"password" is required',
            });
            (0, vitest_1.expect)(req.sanitize.data).toBeUndefined();
        }));
        (0, vitest_1.it)("should forward sanitization errors to next", () => __awaiter(void 0, void 0, void 0, function* () {
            const schema = joi_1.default.object({
                username: joi_1.default.string().required(),
            });
            const sanitizeError = new Error("Sanitization failed");
            req.sanitize.body.only.mockImplementation(() => {
                throw sanitizeError;
            });
            const middleware = (0, validate_middleware_1.validate)(schema, ["username"]);
            yield middleware(req, res, next);
            (0, vitest_1.expect)(next).toHaveBeenCalledOnce();
            (0, vitest_1.expect)(next).toHaveBeenCalledWith(sanitizeError);
            (0, vitest_1.expect)(req.sanitize.data).toBeUndefined();
        }));
    });
    (0, vitest_1.describe)("Joi configuration", () => {
        (0, vitest_1.it)("should validate with abortEarly disabled and stripUnknown enabled", () => __awaiter(void 0, void 0, void 0, function* () {
            const schema = joi_1.default.object({
                username: joi_1.default.string().required(),
                password: joi_1.default.string().required(),
            });
            req.sanitize.body.only.mockReturnValue({});
            const validateAsync = vitest_1.vi.spyOn(schema, "validateAsync");
            const middleware = (0, validate_middleware_1.validate)(schema, ["username", "password"]);
            yield middleware(req, res, next);
            (0, vitest_1.expect)(validateAsync).toHaveBeenCalledOnce();
            (0, vitest_1.expect)(validateAsync).toHaveBeenCalledWith({}, {
                abortEarly: false,
                stripUnknown: true,
            });
            (0, vitest_1.expect)(next).toHaveBeenCalledOnce();
            const error = getNextError();
            (0, vitest_1.expect)(error).toBeInstanceOf(joi_1.default.ValidationError);
            (0, vitest_1.expect)(error).toMatchObject({
                details: vitest_1.expect.arrayContaining([
                    vitest_1.expect.objectContaining({
                        path: ["username"],
                        type: "any.required",
                    }),
                    vitest_1.expect.objectContaining({
                        path: ["password"],
                        type: "any.required",
                    }),
                ]),
            });
            (0, vitest_1.expect)(req.sanitize.data).toBeUndefined();
        }));
    });
    (0, vitest_1.describe)("schema factory", () => {
        (0, vitest_1.it)("should resolve the schema from the request", () => __awaiter(void 0, void 0, void 0, function* () {
            const schema = joi_1.default.object({
                username: joi_1.default.string().required(),
            });
            const schemaFactory = vitest_1.vi.fn().mockReturnValue(schema);
            const input = {
                username: "testuser",
            };
            req.sanitize.body.only.mockReturnValue(input);
            const middleware = (0, validate_middleware_1.validate)(schemaFactory, ["username"]);
            yield middleware(req, res, next);
            (0, vitest_1.expect)(schemaFactory).toHaveBeenCalledOnce();
            (0, vitest_1.expect)(schemaFactory).toHaveBeenCalledWith(req);
            (0, vitest_1.expect)(req.sanitize.data).toEqual(input);
            (0, vitest_1.expect)(next).toHaveBeenCalledOnce();
            (0, vitest_1.expect)(next).toHaveBeenCalledWith();
        }));
        (0, vitest_1.it)("should forward errors thrown by the schema factory", () => __awaiter(void 0, void 0, void 0, function* () {
            const factoryError = new Error("Failed to create schema");
            const schemaFactory = vitest_1.vi.fn().mockImplementation(() => {
                throw factoryError;
            });
            const middleware = (0, validate_middleware_1.validate)(schemaFactory, ["username"]);
            yield middleware(req, res, next);
            (0, vitest_1.expect)(schemaFactory).toHaveBeenCalledOnce();
            (0, vitest_1.expect)(next).toHaveBeenCalledOnce();
            (0, vitest_1.expect)(next).toHaveBeenCalledWith(factoryError);
            (0, vitest_1.expect)(req.sanitize.data).toBeUndefined();
        }));
    });
    (0, vitest_1.describe)("unknown fields", () => {
        (0, vitest_1.it)("should strip unknown fields from the validated result", () => __awaiter(void 0, void 0, void 0, function* () {
            const schema = joi_1.default.object({
                username: joi_1.default.string().required(),
                password: joi_1.default.string().required(),
            });
            const input = {
                username: "testuser",
                password: "password123",
                unexpected: "should be removed",
            };
            req.sanitize.body.only.mockReturnValue(input);
            const middleware = (0, validate_middleware_1.validate)(schema, ["username", "password", "unexpected"]);
            yield middleware(req, res, next);
            (0, vitest_1.expect)(req.sanitize.data).toEqual({
                username: "testuser",
                password: "password123",
            });
            (0, vitest_1.expect)(req.sanitize.data).not.toHaveProperty("unexpected");
            (0, vitest_1.expect)(next).toHaveBeenCalledOnce();
            (0, vitest_1.expect)(next).toHaveBeenCalledWith();
        }));
    });
});
