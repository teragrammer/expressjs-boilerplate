// src/common/middleware/validate.middleware.ts
import {NextFunction, Request, Response} from "express";
import type {ObjectSchema} from "joi";

type SchemaFactory = (req: Request) => ObjectSchema;

export const validate = (schemaOrFactory: ObjectSchema | SchemaFactory, fields: string[]) => {
    return async (
        req: Request,
        _res: Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            // Resolve schema dynamically if it's a factory function
            const schema = typeof schemaOrFactory === "function"
                ? schemaOrFactory(req)
                : schemaOrFactory;

            const data = req.sanitize.body.only(fields);

            req.sanitize.data = await schema.validateAsync(data, {
                abortEarly: false,
                stripUnknown: true,
            });

            next();
        } catch (error) {
            next(error);
        }
    };
};