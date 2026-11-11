"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.configureMiddleware = configureMiddleware;
// src/config/http.ts
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const hpp_1 = __importDefault(require("hpp"));
const compression_1 = __importDefault(require("compression"));
const express_useragent_1 = require("express-useragent");
const environment_1 = require("./environment");
function configureMiddleware(app) {
    configureBodyParsing(app);
    configureSecurity(app);
    configureProxy(app);
    configureCompression(app);
}
function configureBodyParsing(app) {
    app.use(express_1.default.json({ limit: "100kb" }));
    app.use(express_1.default.urlencoded({
        extended: true,
        limit: "100kb",
    }));
}
function configureSecurity(app) {
    app.use((0, helmet_1.default)({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'none'"],
                frameAncestors: ["'none'"],
            },
        },
        crossOriginEmbedderPolicy: false,
        crossOriginResourcePolicy: { policy: "same-origin" },
    }));
    app.use((0, hpp_1.default)());
    app.disable("x-powered-by");
    app.use((0, express_useragent_1.express)());
    // Parse CORS origins
    let corsOrigin;
    const isProduction = environment_1.__ENV.NODE_ENV === "production";
    if (!environment_1.__ENV.CORS_ORIGINS || environment_1.__ENV.CORS_ORIGINS.trim() === "") {
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
    }
    else if (environment_1.__ENV.CORS_ORIGINS === "*") {
        if (isProduction) {
            throw new Error("CORS wildcard (*) is not allowed in production with credentials");
        }
        corsOrigin = true; // Allow all in development only
    }
    else {
        corsOrigin = environment_1.__ENV.CORS_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean);
        if (corsOrigin.length === 0) {
            throw new Error("CORS_ORIGINS must contain at least one valid origin");
        }
    }
    app.use((0, cors_1.default)({
        origin: corsOrigin,
        credentials: true,
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "X-Request-ID", "Idempotency-Key"],
        exposedHeaders: ["X-Request-ID", "Retry-After"],
        maxAge: 86400, // 24 hours
    }));
}
function configureProxy(app) {
    if (environment_1.__ENV.HAS_PROXY) {
        app.set("trust proxy", true);
    }
}
function configureCompression(app) {
    app.use((0, compression_1.default)({
        filter: (req, res) => {
            if (req.headers["x-no-compression"]) {
                return false;
            }
            return compression_1.default.filter(req, res);
        },
    }));
}
