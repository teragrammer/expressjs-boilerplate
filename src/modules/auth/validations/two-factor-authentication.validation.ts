// src/modules/auth/validations/two-factor-authentication.validation.ts
import Joi from "../../../shared/validations";

export const verifyOtpSchema = Joi.object({
    code: Joi.string()
        .pattern(/^\d+$/)
        .required(),
});
