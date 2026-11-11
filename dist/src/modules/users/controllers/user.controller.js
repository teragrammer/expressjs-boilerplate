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
exports.UserController = void 0;
const catch_async_1 = __importDefault(require("../../../common/utils/catch-async"));
const errors_1 = require("../../../common/utils/errors");
const messages_1 = __importDefault(require("../../../common/utils/messages"));
class UserController {
    constructor(userService) {
        this.userService = userService;
        this.create = (0, catch_async_1.default)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const user = yield this.userService.createUser(req.sanitize.data);
            res.status(200).json({ id: user.id });
        }));
        this.update = (0, catch_async_1.default)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const id = Number(req.params.id);
            yield this.userService.updateUser(id, req.sanitize.data);
            res.status(200).send();
        }));
        this.browse = (0, catch_async_1.default)((req, res) => __awaiter(this, void 0, void 0, function* () {
            /*
             * Cursor-based pagination
             *
             * First request:
             *   GET /users?limit=20
             *
             * The response contains:
             *   {
             *       "hasMore": true,
             *       "nextCursor": 481
             *   }
             *
             * To fetch the next page, send the returned cursor:
             *   GET /users?limit=20&cursor=481
             *
             * IMPORTANT:
             * - The cursor must come from the previous response's `nextCursor`.
             * - Do not calculate or modify the cursor on the client.
             * - When using a cursor, keep the same filters/search parameters.
             *
             * Example:
             *   GET /users?role_id=2&status=Activated&limit=20
             *
             * Next page:
             *   GET /users?role_id=2&status=Activated&limit=20&cursor=481
             *
             * When `hasMore` is false, `nextCursor` will be null and there
             * are no more records to fetch.
             */
            const result = yield this.userService.browseUsers({
                role_id: req.sanitize.query.numeric("role_id") || undefined,
                status: req.sanitize.query.get("status") || undefined,
                search: req.sanitize.query.get("search") || undefined,
                // `undefined` on the first request means "start from the newest user".
                // On subsequent requests, this is the `nextCursor` returned by the
                // previous API response.
                cursor: req.cursorPagination.cursor,
                // Maximum number of records returned in one request.
                limit: req.cursorPagination.perPage,
            });
            res.status(200).json(result);
        }));
        this.view = (0, catch_async_1.default)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const id = Number(req.params.id);
            if (!Number.isSafeInteger(id) || id <= 0) {
                throw new errors_1.AppError(messages_1.default.INVALID_PATH_PARAM);
            }
            const user = yield this.userService.findById(id);
            return res.status(200).json(user);
        }));
        this.delete = (0, catch_async_1.default)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const id = Number(req.params.id);
            if (!Number.isSafeInteger(id) || id <= 0) {
                throw new errors_1.AppError(messages_1.default.INVALID_PATH_PARAM);
            }
            yield this.userService.softDelete(id);
            res.status(200).send();
        }));
    }
}
exports.UserController = UserController;
