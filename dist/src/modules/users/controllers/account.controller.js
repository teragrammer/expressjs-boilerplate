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
exports.AccountController = void 0;
const catch_async_1 = __importDefault(require("../../../common/utils/catch-async"));
const request_credentials_1 = require("../../../common/utils/request-credentials");
class AccountController {
    constructor(accountService) {
        this.accountService = accountService;
        this.information = (0, catch_async_1.default)((req, res) => __awaiter(this, void 0, void 0, function* () {
            (0, request_credentials_1.assertCredentials)(req);
            const token = yield this.accountService.information(req.credentials.jwt.uid, req.sanitize.data, req.credentials.jwt.tid, req.credentials.jwt.tfa);
            res.status(200).json(token);
        }));
        this.password = (0, catch_async_1.default)((req, res) => __awaiter(this, void 0, void 0, function* () {
            (0, request_credentials_1.assertCredentials)(req);
            const token = yield this.accountService.password(yield req.credentials.user(), req.sanitize.data, req.credentials.jwt.tid);
            res.status(200).json(token);
        }));
    }
}
exports.AccountController = AccountController;
