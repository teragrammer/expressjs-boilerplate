"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveSender = resolveSender;
// src/modules/system/settings/mail-settings.ts
const environment_1 = require("../../../config/environment");
/**
 * Resolves the outbound sender address.
 *
 * The per-feature setting wins; `MAIL_FROM_ADDRESS` is the fallback
 * for deployments that do not configure a sender per feature.
 */
function resolveSender(settings, featureKey) {
    const configured = settings[featureKey];
    if (configured && configured.trim() !== "") {
        return configured;
    }
    return environment_1.__ENV.MAIL_FROM_ADDRESS;
}
