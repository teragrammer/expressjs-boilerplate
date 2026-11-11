// src/modules/system/route-guards/route-guard-create.schema.ts
import Joi from '../../../shared/validations/joi';
import {validateExists} from "../../../shared/validations/database/exists";
import {normalizeRoute} from "./route-guard.catalog";

export const routeGuardCreateSchema = Joi.object({
    role_id: Joi.number().integer().required()
        .external(validateExists("roles", {column: "id"})),
    route: Joi.string().min(3).max(100).required()
        .custom((value: string, helpers: import("joi").CustomHelpers) => {
            try {
                return normalizeRoute(value);
            } catch (error) {
                return helpers.error("any.invalid");
            }
        })
        .messages({
            "any.invalid":
                "The route must use the 'resource:action' format, for example 'users:create'.",
        }),
});
