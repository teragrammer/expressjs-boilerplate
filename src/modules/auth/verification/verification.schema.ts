// src/modules/auth/verification/verification.schema.ts
import Joi from "../../../shared/validations/joi";

/**
 * Schema for a verification send/confirm request.
 *
 * Both endpoints accept a single field: the target to verify, or the
 * code to confirm.
 */
export const sendVerificationSchema = Joi.object({
    email: Joi.string().email().max(180).allow(null, ""),
    phone: Joi.string().min(10).max(16).allow(null, ""),
    code: Joi.string().min(6).max(128).allow(null, ""),
}).or("email", "phone", "code");
