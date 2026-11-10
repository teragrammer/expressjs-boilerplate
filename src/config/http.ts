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
    app.use(express.json());
    app.use(
        express.urlencoded({
            extended: true,
        }),
    );
}

function configureSecurity(
    app: express.Application,
): void {
    app.use(helmet());
    app.use(hpp());

    app.disable("x-powered-by");

    app.use(useragent());

    const corsOrigin =
        __ENV.CORS_ORIGINS === "*" || !__ENV.CORS_ORIGINS
            ? true
            : __ENV.CORS_ORIGINS.split(",").map((o) => o.trim());

    app.use(
        cors({
            origin: corsOrigin,
            credentials: true,
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
