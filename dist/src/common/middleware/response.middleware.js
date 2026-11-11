"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const messages_1 = __importDefault(require("../utils/messages"));
const responseHandler = (_req, res, next) => {
    res.failed = {
        message: (status, message, code) => {
            const systemMessage = (code && code in messages_1.default
                ? messages_1.default[code]
                : messages_1.default.SERVER_ERROR);
            res.status(status).json({
                code: systemMessage.code,
                message: message !== null && message !== void 0 ? message : systemMessage.message,
            });
        },
        fields: (status, errors) => {
            res.status(status).json({
                code: messages_1.default.VALIDATION_FAILED.code,
                message: messages_1.default.VALIDATION_FAILED.message,
                errors: Array.isArray(errors)
                    ? errors
                    : [errors],
            });
        },
    };
    next();
};
exports.default = responseHandler;
