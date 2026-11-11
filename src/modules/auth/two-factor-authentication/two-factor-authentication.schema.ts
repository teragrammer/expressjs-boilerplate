// src/modules/auth/two-factor-authentication/two-factor-authentication.schema.ts
import Joi from "../../../shared/validations/joi";

export const verifyOtpSchema = Joi.object({
    code: Joi.string()
        .pattern(/^\d+$/)
        .length(6)
        .required()
        .messages({
            "string.length": "The OTP must be exactly 6 digits.",
            "string.pattern.base": "The OTP must contain digits only.",
        }),
});

export const disableTfaSchema = Joi.object({
    password: Joi.string()
        .min(1)
        .max(128)
        .required()
        .messages({
            "any.required": "The current password is required.",
        }),
});
