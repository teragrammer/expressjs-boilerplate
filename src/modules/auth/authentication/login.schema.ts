// src/modules/auth/authentication/login.schema.ts

import Joi from '../../../shared/validations/joi';

export const loginSchema = Joi.object({
    username: Joi.string().trim().required(),
    password: Joi.string().required(),
});