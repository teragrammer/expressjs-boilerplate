// src/modules/users/validations/user-create.schema.ts
import Joi from '../../../shared/validations/joi';
import {validateUnique, validateExists} from "../../../shared/validations";
import {STATUSES} from "../user.interface";

export const userCreateSchema = Joi.object({
    first_name: Joi.string().min(1).max(100).required(),
    middle_name: Joi.string().min(1).max(100).allow(null, ""),
    last_name: Joi.string().min(1).max(100).required(),

    address: Joi.string().max(100).allow(null, ""),
    comments: Joi.string().max(100).allow(null, ""),
    status: Joi.string().valid(...STATUSES).allow(null, ""),

    role_id: Joi.number().integer().required()
        .external(validateExists("roles", {column: "id"})),
    phone: Joi.string().min(10).max(16).allow(null, "")
        .external(validateUnique("users", "phone")),
    email: Joi.string().email().max(180).allow(null, "")
        .external(validateUnique("users", "email")),
    username: Joi.string().min(2).max(16).pattern(/^[a-zA-Z0-9_]+$/).allow(null, "")
        .external(validateUnique("users", "username"))
        .required(),
    password: Joi.string().min(8).max(32)
        .pattern(/[A-Z]/)           // At least one uppercase letter
        .pattern(/[a-z]/)           // At least one lowercase letter
        .pattern(/[0-9]/)           // At least one number
        .pattern(/[^A-Za-z0-9]/)    // At least one special character (e.g., !, @, #)
        .messages({
            "string.min": "Password should be at least 8 characters long.",
            "string.max": "Password should be no longer than 32 characters.",
            "string.pattern.base": "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character.",
            "any.required": "Password is required.",
        })
        .required(),
});