"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUserAgent = getUserAgent;
exports.getClientIp = getClientIp;
exports.getUserAgentInfo = getUserAgentInfo;
/**
 * Reads the User-Agent header.
 *
 * `req.get()` is not available on every request-like object (unit
 * tests use partial mocks), so the raw header is read directly.
 */
function getUserAgent(req) {
    var _a;
    const header = (_a = req.headers) === null || _a === void 0 ? void 0 : _a["user-agent"];
    if (Array.isArray(header)) {
        return header[0];
    }
    return typeof header === "string" ? header : undefined;
}
/**
 * Reads the client IP.
 */
function getClientIp(req) {
    var _a, _b, _c;
    return (_c = (_a = req.ip) !== null && _a !== void 0 ? _a : (_b = req.socket) === null || _b === void 0 ? void 0 : _b.remoteAddress) !== null && _c !== void 0 ? _c : null;
}
/**
 * Reads the parsed user-agent information, when the middleware ran.
 */
function getUserAgentInfo(req) {
    var _a, _b, _c, _d;
    return {
        browser: (_b = (_a = req.useragent) === null || _a === void 0 ? void 0 : _a.browser) !== null && _b !== void 0 ? _b : null,
        os: (_d = (_c = req.useragent) === null || _c === void 0 ? void 0 : _c.os) !== null && _d !== void 0 ? _d : null,
    };
}
