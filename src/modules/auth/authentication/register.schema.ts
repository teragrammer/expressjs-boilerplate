// src/modules/auth/authentication/register.schema.ts
import Joi from '../../../shared/validations/joi';
import {validateCompositeUnique} from "../../../shared/validations/database/unique"; // Using your customized extended Joi

export const registerSchema = Joi.object({
    first_name: Joi.string().trim().min(2).max(100).required(),
    middle_name: Joi.string().trim().min(2).max(100).allow(null, ""),
    last_name: Joi.string().trim().min(2).max(100).required(),

    // Security/Performance optimization: uniquely validate via async external extensions
    username: Joi.string()
        .trim()
        .min(3)
        .max(16)
        .pattern(/^[a-zA-Z0-9_]+$/)
        .required()
        .external(validateCompositeUnique('users', ['username'])),

    email: Joi.string()
        .trim()
        .email()
        .max(180)
        .required()
        .external(validateCompositeUnique('users', ['email'])),

    password: Joi.string()
        .min(8)
        .max(32)
        .pattern(/[A-Z]/)           // At least one uppercase letter
        .pattern(/[a-z]/)           // At least one lowercase letter
        .pattern(/[0-9]/)           // At least one number
        .pattern(/[^A-Za-z0-9]/)    // At least one special character
        .messages({
            "string.min": "Password should be at least 8 characters long.",
            "string.max": "Password should be no longer than 32 characters.",
            "string.pattern.base": "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character.",
            "any.required": "Password is required.",
        })
        .required(),
});