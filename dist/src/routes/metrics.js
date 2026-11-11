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
// src/routes/metrics.ts
const express_1 = require("express");
const catch_async_1 = __importDefault(require("../common/utils/catch-async"));
const metrics_1 = require("../common/metrics/metrics");
const environment_1 = require("../config/environment");
/**
 * Prometheus scrape endpoint.
 *
 * Mounted at the application root (outside `/api/v1`) because scrapers
 * conventionally target `/metrics`. The endpoint is unauthenticated by
 * design and must be restricted at the network layer.
 */
exports.default = () => {
    const router = (0, express_1.Router)();
    router.get(environment_1.__ENV.METRICS_PATH, (0, catch_async_1.default)((_req, res) => __awaiter(void 0, void 0, void 0, function* () {
        if (!environment_1.__ENV.METRICS_ENABLED) {
            res.status(404).json({ code: "DATA_NOT_FOUND" });
            return;
        }
        res.setHeader("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
        res.status(200).send(yield (0, metrics_1.renderMetrics)());
    })));
    return router;
};
