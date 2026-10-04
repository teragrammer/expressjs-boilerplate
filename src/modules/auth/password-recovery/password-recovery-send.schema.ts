// src/modules/auth/password-recovery/password-recovery-send.schema.ts
import Joi from '../../../shared/validations/joi';
import {RECOVERY_EMAIL, TYPES} from "./password-recovery.interface";

export const passwordRecoverySendSchema = Joi.object({
    type: Joi.string().valid(...TYPES).required(),
    send_to: Joi.string().required().when("type", {
        is: RECOVERY_EMAIL,
        then: Joi.string().email().max(100),
        otherwise: Joi.string().min(1).max(18).phone(),
    }),
});