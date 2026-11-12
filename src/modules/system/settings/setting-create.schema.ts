// src/modules/system/settings/setting-create.schema.ts
import Joi from '../../../shared/validations/joi';
import {validateCompositeUnique} from "../../../shared/validations/database/unique";
import {DATA_TYPES} from "./setting.interface";

export const settingCreateSchema = Joi.object({
    name: Joi.string().min(1).max(50).required(),
    slug: Joi.string().min(1).max(50).required()
        .external(validateCompositeUnique("settings", ["slug"])),
    value: Joi.any(),
    description: Joi.string().min(1).max(200),
    type: Joi.string().valid(...DATA_TYPES).required(),
    is_disabled: Joi.number().valid(0, 1).required(),
    is_public: Joi.number().valid(0, 1).required(),
});