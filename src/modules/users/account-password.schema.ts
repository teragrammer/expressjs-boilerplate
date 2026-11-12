// src/modules/users/account-password.schema.ts
import Joi from '../../shared/validations/joi';
import {validateCompositeUnique} from "../../shared/validations/database/unique";

export const accountPasswordSchema = (userId: string | number) => Joi.object({
    current_password: Joi.string().required(),
    new_password: Joi.string().min(8).max(32)
        .pattern(/[A-Z]/)
        .pattern(/[a-z]/)
        .pattern(/[0-9]/)
        .pattern(/[^A-Za-z0-9]/)
        .messages({
            "string.min": "Password should be at least 8 characters long.",
            "string.max": "Password should be no longer than 32 characters.",
            "string.pattern.base": "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character.",
            "any.required": "Password is required.",
        })
        .required(),
    username: Joi.string().min(2).max(16).pattern(/^[a-zA-Z0-9_]+$/)
        .external(validateCompositeUnique("users", ["username"], {ignoreId: userId}))
        .allow(null, ""),
    email: Joi.string().email().max(180)
        .external(validateCompositeUnique("users", ["email"], {ignoreId: userId}))
        .allow(null, ""),
    phone: Joi.string().min(10).max(16)
        .phone()
        .external(validateCompositeUnique("users", ["phone"], {ignoreId: userId}))
        .allow(null, ""),
});