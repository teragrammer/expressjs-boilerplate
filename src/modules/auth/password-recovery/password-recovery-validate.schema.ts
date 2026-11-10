// src/modules/auth/password-recovery/password-recovery-validate.schema.ts

import Joi from '../../../shared/validations/joi';
import {RECOVERY_EMAIL, TYPES} from "./password-recovery.interface";

export const passwordRecoveryValidateSchema = Joi.object({
    type: Joi.string().valid(...TYPES).required(),
    send_to: Joi.string().required().when("type", {
        is: RECOVERY_EMAIL,
        then: Joi.string().email().max(100),
        otherwise: Joi.string().min(1).max(18).phone(),
    }),
    code: Joi.string().length(6).required(),
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
});