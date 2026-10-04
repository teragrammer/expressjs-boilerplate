// src/modules/auth/two-factor-authentication/two-factor-authentication.schema.ts
import Joi from "../../../shared/validations/joi";

export const verifyOtpSchema = Joi.object({
    code: Joi.string()
        .pattern(/^\d+$/)
        .required(),
});
