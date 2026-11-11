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
exports.canonicalize = canonicalize;
exports.hashRequest = hashRequest;
exports.idempotency = idempotency;
// src/common/middleware/idempotency.middleware.ts
const node_crypto_1 = require("node:crypto");
const database_1 = require("../../config/database");
const errors_1 = require("../utils/errors");
const messages_1 = __importDefault(require("../utils/messages"));
const logger_1 = require("../../config/logger");
/**
 * How long a completed idempotent response is replayable.
 */
const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;
/**
 * Header carrying the idempotency key.
 */
const IDEMPOTENCY_HEADER = "idempotency-key";
/**
 * Maximum accepted key length.
 */
const MAX_KEY_LENGTH = 255;
/**
 * Canonicalises a request body for hashing.
 *
 * Object keys are sorted so two semantically identical payloads
 * produce the same hash regardless of key order.
 */
function canonicalize(value) {
    if (value === null || typeof value !== "object") {
        return JSON.stringify(value !== null && value !== void 0 ? value : null);
    }
    if (Array.isArray(value)) {
        return `[${value.map(canonicalize).join(",")}]`;
    }
    const entries = Object.entries(value)
        .filter(([, entry]) => entry !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalize(entry)}`);
    return `{${entries.join(",")}}`;
}
/**
 * Computes the request hash used to detect a key reuse with a
 * different payload.
 */
function hashRequest(body) {
    return (0, node_crypto_1.createHash)("sha256").update(canonicalize(body)).digest("hex");
}
/**
 * Resolves the acting user id for key scoping.
 *
 * Keys are scoped per user so one user's key cannot be replayed by
 * another.
 */
function resolveUserId(req) {
    var _a, _b, _c;
    return (_c = (_b = (_a = req.credentials) === null || _a === void 0 ? void 0 : _a.jwt) === null || _b === void 0 ? void 0 : _b.uid) !== null && _c !== void 0 ? _c : null;
}
/**
 * Adds idempotent replay support to an unsafe endpoint.
 *
 * A repeated request with the same `Idempotency-Key` and the same
 * payload returns the stored response instead of performing the write
 * twice. Reusing a key with a different payload is rejected with 409.
 */
function idempotency(options) {
    var _a;
    const leaseMs = (_a = options.leaseMs) !== null && _a !== void 0 ? _a : 60000;
    return function idempotencyMiddleware(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d;
            const rawKey = req.headers[IDEMPOTENCY_HEADER];
            // The header is optional: without it the endpoint behaves
            // exactly as before.
            if (typeof rawKey !== "string" || rawKey.trim() === "") {
                next();
                return;
            }
            const key = rawKey.trim();
            if (key.length > MAX_KEY_LENGTH) {
                next(new errors_1.AppError(messages_1.default.INVALID_REQUEST, `The '${IDEMPOTENCY_HEADER}' header must be at most ${MAX_KEY_LENGTH} characters.`));
                return;
            }
            const userId = resolveUserId(req);
            const route = options.scope;
            const requestHash = hashRequest((_b = (_a = req.sanitize) === null || _a === void 0 ? void 0 : _a.data) !== null && _b !== void 0 ? _b : req.body);
            const now = new Date();
            try {
                /*
                 * Look for an existing reservation first.
                 *
                 * The order matters: a request that arrives while another
                 * one holds the key must be recognised as a duplicate
                 * rather than mistaken for its own reservation.
                 */
                const existing = yield database_1.db
                    .selectFrom("idempotency_keys")
                    .selectAll()
                    .where("key", "=", key)
                    .where("route", "=", route)
                    .where((eb) => eb.or([
                    eb("user_id", "is", null),
                    userId === null
                        ? eb("user_id", "is", null)
                        : eb("user_id", "=", userId),
                ]))
                    .executeTakeFirst();
                if (existing) {
                    if (existing.request_hash !== requestHash) {
                        next(new errors_1.AppError(messages_1.default.DUPLICATE_DATA, "This idempotency key was already used with a different payload."));
                        return;
                    }
                    if (existing.status === "completed") {
                        res.setHeader("Idempotency-Replayed", "true");
                        res
                            .status((_c = existing.response_status) !== null && _c !== void 0 ? _c : 200)
                            .json((_d = existing.response_body) !== null && _d !== void 0 ? _d : {});
                        return;
                    }
                    /*
                     * An in-flight request: either wait for it to finish or
                     * reject the duplicate. The lease bounds the wait.
                     */
                    const lockedAt = existing.locked_at
                        ? new Date(existing.locked_at).getTime()
                        : now.getTime();
                    if (now.getTime() - lockedAt < leaseMs) {
                        next(new errors_1.AppError(messages_1.default.DUPLICATE_DATA, "A request with this idempotency key is still in progress."));
                        return;
                    }
                    // The lease expired: take over the reservation.
                    yield database_1.db
                        .updateTable("idempotency_keys")
                        .set({
                        status: "in_progress",
                        locked_at: now,
                        updated_at: now,
                    })
                        .where("id", "=", existing.id)
                        .execute();
                }
                else {
                    /*
                     * Reserve the key.
                     *
                     * A unique index on (key, route, user_id) makes the
                     * reservation atomic; `RETURNING` yields no row when
                     * another request won the race.
                     */
                    const inserted = yield database_1.db
                        .insertInto("idempotency_keys")
                        .values({
                        key,
                        user_id: userId,
                        route,
                        request_hash: requestHash,
                        status: "in_progress",
                        locked_at: now,
                        created_at: now,
                        updated_at: now,
                        expires_at: new Date(now.getTime() + IDEMPOTENCY_TTL_MS),
                    })
                        .onConflict((oc) => oc.doNothing())
                        .returning("id")
                        .executeTakeFirst();
                    if (!inserted) {
                        next(new errors_1.AppError(messages_1.default.DUPLICATE_DATA, "A request with this idempotency key is still in progress."));
                        return;
                    }
                }
            }
            catch (error) {
                /*
                 * A failure in the idempotency store must not block the
                 * request: the endpoint behaves as if no key was sent.
                 */
                if (error instanceof errors_1.AppError) {
                    next(error);
                    return;
                }
                logger_1.logger.error({ message: error.message }, "Idempotency check failed; continuing without it");
                next();
                return;
            }
            /*
             * Capture the response so it can be replayed later.
             */
            const originalJson = res.json.bind(res);
            res.json = ((body) => {
                void database_1.db
                    .updateTable("idempotency_keys")
                    .set({
                    status: "completed",
                    response_status: res.statusCode,
                    response_body: body && typeof body === "object"
                        ? body
                        : { body },
                    locked_at: null,
                    updated_at: new Date(),
                })
                    .where("key", "=", key)
                    .where("route", "=", route)
                    .execute()
                    .catch((error) => {
                    logger_1.logger.error({ message: error.message }, "Failed to store the idempotent response");
                });
                return originalJson(body);
            });
            next();
        });
    };
}
