// src/common/middleware/idempotency.middleware.ts
import {createHash} from "node:crypto";
import {NextFunction, Request, Response} from "express";
import {sql} from "kysely";
import {db} from "../../config/database";
import {AppError} from "../utils/errors";
import Messages from "../utils/messages";
import {logger} from "../../config/logger";

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

export interface IdempotencyOptions {
    /**
     * Scopes the key to a route, so the same key may be reused for a
     * different endpoint.
     */
    scope: string;
    /**
     * Maximum time an in-flight reservation is honoured.
     */
    leaseMs?: number;
}

/**
 * Canonicalises a request body for hashing.
 *
 * Object keys are sorted so two semantically identical payloads
 * produce the same hash regardless of key order.
 */
export function canonicalize(value: unknown): string {
    if (value === null || typeof value !== "object") {
        return JSON.stringify(value ?? null);
    }

    if (Array.isArray(value)) {
        return `[${value.map(canonicalize).join(",")}]`;
    }

    const entries = Object.entries(value as Record<string, unknown>)
        .filter(([, entry]) => entry !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalize(entry)}`);

    return `{${entries.join(",")}}`;
}

/**
 * Computes the request hash used to detect a key reuse with a
 * different payload.
 */
export function hashRequest(body: unknown): string {
    return createHash("sha256").update(canonicalize(body)).digest("hex");
}

/**
 * Resolves the acting user id for key scoping.
 *
 * Keys are scoped per user so one user's key cannot be replayed by
 * another.
 */
function resolveUserId(req: Request): number | null {
    return req.credentials?.jwt?.uid ?? null;
}

/**
 * Adds idempotent replay support to an unsafe endpoint.
 *
 * A repeated request with the same `Idempotency-Key` and the same
 * payload returns the stored response instead of performing the write
 * twice. Reusing a key with a different payload is rejected with 409.
 */
export function idempotency(options: IdempotencyOptions) {
    const leaseMs = options.leaseMs ?? 60_000;

    return async function idempotencyMiddleware(
        req: Request,
        res: Response,
        next: NextFunction,
    ): Promise<void> {
        const rawKey = req.headers[IDEMPOTENCY_HEADER];

        // The header is optional: without it the endpoint behaves
        // exactly as before.
        if (typeof rawKey !== "string" || rawKey.trim() === "") {
            next();
            return;
        }

        const key = rawKey.trim();

        if (key.length > MAX_KEY_LENGTH) {
            next(
                new AppError(
                    Messages.INVALID_REQUEST,
                    `The '${IDEMPOTENCY_HEADER}' header must be at most ${MAX_KEY_LENGTH} characters.`,
                ),
            );
            return;
        }

        const userId = resolveUserId(req);
        const route = options.scope;
        /*
         * Prefer the validated payload. The sanitizer initialises
         * `req.sanitize.data` to an empty object, so an emptiness check
         * (not a truthiness check) is required to fall back to the raw
         * body on routes that do not run the validator first.
         */
        const validated = req.sanitize?.data;
        const hashSource =
            validated &&
            typeof validated === "object" &&
            Object.keys(validated as Record<string, unknown>).length > 0
                ? validated
                : req.body;
        const requestHash = hashRequest(hashSource);
        const now = new Date();
        /*
         * The reservation id captured at insert time scopes the
         * completion update to exactly one row. Updating by
         * (key, route) would let a second user overwrite the first
         * user's stored response.
         */
        let reservationId: string | null = null;

        try {
            /*
             * Look for an existing reservation first.
             *
             * The order matters: a request that arrives while another
             * one holds the key must be recognised as a duplicate
             * rather than mistaken for its own reservation.
             */
            const existing = await db
                .selectFrom("idempotency_keys")
                .selectAll()
                .where("key", "=", key)
                .where("route", "=", route)
                .where((eb) =>
                    userId === null
                        ? eb("user_id", "is", null)
                        : eb("user_id", "=", userId),
                )
                .executeTakeFirst();

            if (existing) {
                reservationId = existing.id;

                if (existing.request_hash !== requestHash) {
                    next(
                        new AppError(
                            Messages.DUPLICATE_DATA,
                            "This idempotency key was already used with a different payload.",
                        ),
                    );
                    return;
                }

                if (existing.status === "completed") {
                    res.setHeader("Idempotency-Replayed", "true");
                    res
                        .status(existing.response_status ?? 200)
                        .json(existing.response_body ?? {});
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
                    next(
                        new AppError(
                            Messages.DUPLICATE_DATA,
                            "A request with this idempotency key is still in progress.",
                        ),
                    );
                    return;
                }

                // The lease expired: take over the reservation.
                await db
                    .updateTable("idempotency_keys")
                    .set({
                        status: "in_progress",
                        locked_at: now,
                        updated_at: now,
                    })
                    .where("id", "=", existing.id)
                    .execute();
            } else {
                /*
                 * Reserve the key.
                 *
                 * A unique index on (key, route, user_id) makes the
                 * reservation atomic; `RETURNING` yields no row when
                 * another request won the race.
                 */
                const inserted = await db
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
                        expires_at: new Date(
                            now.getTime() + IDEMPOTENCY_TTL_MS,
                        ),
                    })
                    .onConflict((oc) => oc.doNothing())
                    .returning("id")
                    .executeTakeFirst();

                if (!inserted) {
                    next(
                        new AppError(
                            Messages.DUPLICATE_DATA,
                            "A request with this idempotency key is still in progress.",
                        ),
                    );
                    return;
                }

                reservationId = inserted.id;
            }
        } catch (error) {
            /*
             * A failure in the idempotency store must not block the
             * request: the endpoint behaves as if no key was sent.
             */
            if (error instanceof AppError) {
                next(error);
                return;
            }

            logger.error(
                {message: (error as Error).message},
                "Idempotency check failed; continuing without it",
            );

            next();
            return;
        }

        /*
         * Capture the response so it can be replayed later.
         */
        const originalJson = res.json.bind(res);

        res.json = ((body: unknown) => {
            if (reservationId === null) {
                return originalJson(body);
            }

            void db
                .updateTable("idempotency_keys")
                .set({
                    status: "completed",
                    response_status: res.statusCode,
                    response_body:
                        body && typeof body === "object"
                            ? (body as never)
                            : ({body} as never),
                    locked_at: null,
                    updated_at: new Date(),
                })
                .where("id", "=", reservationId)
                .execute()
                .catch((error: Error) => {
                    logger.error(
                        {message: error.message},
                        "Failed to store the idempotent response",
                    );
                });

            return originalJson(body);
        }) as Response["json"];

        next();
    };
}
