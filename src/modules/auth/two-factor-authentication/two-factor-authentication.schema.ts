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

export const recoveryCodeSchema = Joi.object({
    code: Joi.string()
        .pattern(/^[A-Za-z0-9]{4}-[A-Za-z0-9]{4}$/)
        .required()
        .messages({
            "string.pattern.base":
                "A recovery code must look like ABCD-EFGH.",
            "any.required": "A recovery code is required.",
        }),
});
