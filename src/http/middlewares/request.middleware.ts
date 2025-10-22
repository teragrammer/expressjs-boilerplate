import {NextFunction, Request, Response} from "express";
import * as xss from "xss";

const TRIMMED = (object: any) => {
    return object !== null && typeof object === "string" ? object.trim() : object;
};

const EMPTY_TO_NULL = (object: any) => {
    return object === "" ? null : object;
};

const CONVERT_TO_NUMBER = (object: any, defaults: any = 0): any => {
    if (!isNaN(object) && typeof object === "number") return object;
    return !isNaN(object) && typeof object === "string" && object !== "" && object !== null ? Number(object) : defaults;
};

const ONLY = (inputs: any, keys: string[]): Record<string, any> => {
    // If the body exists, filter it based on the given keys
    if (inputs && Array.isArray(keys)) {
        return keys.reduce((result, key) => {
            if (key in inputs) {
                const INPUT = inputs[key];

                result[key] = xss.filterXSS(INPUT);
                result[key] = TRIMMED(INPUT);
                result[key] = EMPTY_TO_NULL(INPUT);
            }

            return result;
        }, {} as Record<string, any>);
    }

    return {};
};

const GET = (inputs: any, key: string, defaults: any = null) => {
    if (key in inputs) {
        const INPUT = inputs[key];
        const result: Record<string, any> = {};

        result[key] = xss.filterXSS(INPUT);
        result[key] = TRIMMED(INPUT);
        result[key] = EMPTY_TO_NULL(INPUT);

        return result;
    }

    return defaults;
};

const requestMiddleware = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    // sanitize inputs from query or body
    req.sanitize = {
        body: {
            get: function (key: string, defaults: any = null) {
                return GET(req.body, key, defaults);
            },
            only: function (keys: string[]): Record<string, any> {
                return ONLY(req.body, keys);
            },
            numeric: function (key: string, defaults: any = 0): any {
                if (key in req.body) return CONVERT_TO_NUMBER(req.body[key], defaults);
                return defaults;
            },
        },

        query: {
            get: function (key: string, defaults: any = null) {
                return GET(req.query, key, defaults);
            },
            numeric: function (key: string, defaults: any = 0): any {
                if (key in req.query) return CONVERT_TO_NUMBER(req.query[key], defaults);
                return defaults;
            },
        },
    };

    // pagination helper
    req.app.set("paginate", () => {
        let perPage: any = req.query.per_page || 10;
        let page: any = req.query.page || 1;

        if (isNaN(perPage)) perPage = 10;
        if (isNaN(page)) page = 1;

        if (page < 1) page = 1;
        let offset = (page - 1) * perPage;

        return {
            offset,
            perPage,
        };
    });

    next();
};

export default requestMiddleware;