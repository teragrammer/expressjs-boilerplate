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
    new_password: Joi.string().min(8).max(100).required(),
});