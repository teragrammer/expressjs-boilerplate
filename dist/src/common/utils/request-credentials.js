"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertCredentials = assertCredentials;
const messages_1 = require("./messages");
const errors_1 = require("./errors");
function assertCredentials(req) {
    if (!req.credentials) {
        throw new errors_1.AppError(messages_1.Messages.INVALID_AUTH_TOKEN);
    }
}
