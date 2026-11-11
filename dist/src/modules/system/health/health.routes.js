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
// src/modules/system/health/health.routes.ts
const express_1 = require("express");
const catch_async_1 = __importDefault(require("../../../common/utils/catch-async"));
const health_service_1 = require("./health.service");
const healthService = new health_service_1.HealthService();
exports.default = () => {
    const router = (0, express_1.Router)();
    /**
     * Liveness probe.
     *
     * Unauthenticated and dependency-free by design: a liveness probe
     * must not fail because a downstream service is unavailable.
     */
    router.get("/live", (_req, res) => {
        res.status(200).json(healthService.live());
    });
    /**
     * Readiness probe.
     *
     * Returns 503 when a required dependency is unavailable. The body
     * contains only up/down state, never versions, hosts or stacks.
     */
    router.get("/ready", (0, catch_async_1.default)((_req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const report = yield healthService.ready();
        res.status(report.status === "ready" ? 200 : 503).json(report);
    })));
    return router;
};
