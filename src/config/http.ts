// src/config/http.ts
import express, {NextFunction, Request, Response,} from "express";
import cors from "cors";
import helmet from "helmet";
import hpp from "hpp";
import compression from "compression";
import {express as useragent} from "express-useragent";

import {logger} from "./logger";
import {__ENV} from "./environment";

export function configureMiddleware(
    app: express.Application,
): void {
    configureBodyParsing(app);
    configureSecurity(app);
    configureProxy(app);
    configureCompression(app);
    configureRequestLogging(app);
}

function configureBodyParsing(
    app: express.Application,
): void {
    app.use(express.json({limit: "100kb"}));
    app.use(
        express.urlencoded({
            extended: true,
            limit: "100kb",
        }),
    );
}

function configureSecurity(
    app: express.Application,
): void {
    app.use(helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'none'"],
                frameAncestors: ["'none'"],
            },
        },
        crossOriginEmbedderPolicy: false,
        crossOriginResourcePolicy: {policy: "same-origin"},
    }));
    app.use(hpp());

    app.disable("x-powered-by");

    app.use(useragent());

    // Parse CORS origins
    let corsOrigin: string[] | boolean;
    const isProduction = __ENV.NODE_ENV === "production";

    if (!__ENV.CORS_ORIGINS || __ENV.CORS_ORIGINS.trim() === "") {
        if (isProduction) {
            throw new Error("CORS_ORIGINS must be explicitly set in production");
        }
        // Development: allow localhost origins
        corsOrigin = [
            "http://localhost:3000",
            "http://localhost:4000",
            "http://127.0.0.1:3000",
            "http://127.0.0.1:4000",
        ];
    } else if (__ENV.CORS_ORIGINS === "*") {
        if (isProduction) {
            throw new Error("CORS wildcard (*) is not allowed in production with credentials");
        }
        corsOrigin = true; // Allow all in development only
    } else {
        corsOrigin = __ENV.CORS_ORIGINS.split(",").map((o: string) => o.trim()).filter(Boolean);
        if ((corsOrigin as string[]).length === 0) {
            throw new Error("CORS_ORIGINS must contain at least one valid origin");
        }
    }

    app.use(
        cors({
            origin: corsOrigin,
            credentials: true,
            methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
            allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "X-Request-ID", "Idempotency-Key"],
            exposedHeaders: ["X-Request-ID", "Retry-After"],
            maxAge: 86400, // 24 hours
        }),
    );
}

function configureProxy(
    app: express.Application,
): void {
    if (__ENV.HAS_PROXY) {
        app.set("trust proxy", true);
    }
}

function configureCompression(
    app: express.Application,
): void {
    app.use(
        compression({
            filter: (
                req: Request,
                res: Response,
            ) => {
                if (
                    req.headers["x-no-compression"]
                ) {
                    return false;
                }

                return compression.filter(
                    req,
                    res,
                );
            },
        }),
    );
}

function configureRequestLogging(
    app: express.Application,
): void {
    app.use(
        (
            req: Request,
            _res: Response,
            next: NextFunction,
        ) => {
            logger.info(
                `${req.method} ${req.originalUrl}`,
            );

            next();
        },
    );
}
