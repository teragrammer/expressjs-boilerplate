// src/shared/validations/index.ts

import Joi from './joi';

export {Joi};
export {validateUnique, validateCompositeUnique} from "./database/unique";
export {validateExists} from "./database/exists";
export * from "./custom";
export default Joi;