// src/modules/users/validations/account-information.schema.ts
import Joi from '../../../shared/validations/joi';

export const accountInformationSchema = Joi.object({
    first_name: Joi.string().min(1).max(100).required(),
    middle_name: Joi.string().min(1).max(100).allow(null, ""),
    last_name: Joi.string().min(1).max(100).required(),
    address: Joi.string().min(10).max(255).allow(null, ""),
});