"use strict";
// src/common/middleware/request.middleware.ts
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const xss = __importStar(require("xss"));
const sanitizeString = (value) => {
    if (typeof value !== "string") {
        return value;
    }
    const cleaned = xss.filterXSS(value, {
        whiteList: {},
        stripIgnoreTag: true,
    }).trim();
    return cleaned === "" ? null : cleaned;
};
const convertToNumber = (value, defaultValue = 0) => {
    if (typeof value === "number" && !isNaN(value)) {
        return value;
    }
    if (typeof value === "string" && value.trim() !== "") {
        const parsed = Number(value);
        return !isNaN(parsed)
            ? parsed
            : defaultValue;
    }
    return defaultValue;
};
const createSanitizer = (source) => ({
    get: (key, defaults) => {
        return key in source
            ? sanitizeString(source[key])
            : defaults;
    },
    only: (keys, defaults) => {
        if (!source || !Array.isArray(keys)) {
            return {};
        }
        return keys.reduce((result, key) => {
            if (key in source) {
                result[key] = sanitizeString(source[key]);
            }
            else if (defaults && key in defaults) {
                result[key] = defaults[key];
            }
            return result;
        }, {});
    },
    numeric: (key, defaults = 0) => {
        return key in source
            ? convertToNumber(source[key], defaults)
            : defaults;
    }
});
const requestHandler = (req, _res, next) => __awaiter(void 0, void 0, void 0, function* () {
    req.sanitize = {
        body: createSanitizer(req.body || {}),
        query: createSanitizer(req.query || {}),
        data: {},
    };
    /*
     * ---------------------------------------------------------
     * Traditional pagination
     * ---------------------------------------------------------
     *
     * Used by existing endpoints.
     */
    const rawPerPage = req.query.per_page;
    const rawPage = req.query.page;
    const perPage = convertToNumber(rawPerPage, 10);
    const page = convertToNumber(rawPage, 1);
    const validatedPage = Math.max(1, Math.floor(page));
    const validatedPerPage = Math.min(100, Math.max(1, Math.floor(perPage)));
    req.pagination = {
        page: validatedPage,
        offset: (validatedPage - 1) * validatedPerPage,
        perPage: validatedPerPage,
    };
    /*
     * ---------------------------------------------------------
     * Cursor pagination
     * ---------------------------------------------------------
     *
     * Used by high-volume endpoints such as users.
     */
    const rawCursor = req.query.cursor;
    const cursor = rawCursor !== undefined
        ? convertToNumber(rawCursor, 0)
        : undefined;
    req.cursorPagination = {
        cursor: cursor && cursor > 0
            ? Math.floor(cursor)
            : undefined,
        perPage: validatedPerPage,
    };
    next();
});
exports.default = requestHandler;
