"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runWithRequestContext = runWithRequestContext;
exports.getRequestContext = getRequestContext;
exports.getRequestId = getRequestId;
exports.updateRequestContext = updateRequestContext;
// src/common/context/request-context.ts
const node_async_hooks_1 = require("node:async_hooks");
const storage = new node_async_hooks_1.AsyncLocalStorage();
/**
 * Runs `callback` with `context` bound to the current async execution.
 */
function runWithRequestContext(context, callback) {
    return storage.run(context, callback);
}
/**
 * Returns the active request context, if any.
 */
function getRequestContext() {
    return storage.getStore();
}
/**
 * Returns the active request id, if any.
 */
function getRequestId() {
    var _a;
    return (_a = storage.getStore()) === null || _a === void 0 ? void 0 : _a.requestId;
}
/**
 * Updates fields on the active request context.
 *
 * Safe to call when no context is active: the call is a no-op.
 */
function updateRequestContext(patch) {
    const context = storage.getStore();
    if (!context) {
        return;
    }
    Object.assign(context, patch);
}
