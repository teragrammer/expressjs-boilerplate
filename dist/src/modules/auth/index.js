"use strict";
// src/modules/auth/index.ts
//
// Public API of the auth module.
//
// Deep imports still work, but external consumers should prefer this
// barrel so internal file moves don't leak across module boundaries.
//
// NOTE: route factories are intentionally excluded. They resolve the
// shared container (config/container.ts), so re-exporting them here
// would introduce a container -> barrel -> routes -> container cycle.
Object.defineProperty(exports, "__esModule", { value: true });
exports.TYPES = exports.RECOVERY_PHONE = exports.RECOVERY_EMAIL = exports.PASSWORD_RECOVERIES_TABLE = exports.PasswordRecoveryRepository = exports.PasswordRecoveryController = exports.PasswordRecoveryService = exports.TwoFactorAuthenticationRepository = exports.TwoFactorAuthenticationController = exports.TwoFactorAuthenticationService = exports.AuthenticationTokenRepository = exports.TokenService = exports.RegisterController = exports.AuthenticationController = exports.AuthenticationService = void 0;
var authentication_service_1 = require("./authentication/authentication.service");
Object.defineProperty(exports, "AuthenticationService", { enumerable: true, get: function () { return authentication_service_1.AuthenticationService; } });
var authentication_controller_1 = require("./authentication/authentication.controller");
Object.defineProperty(exports, "AuthenticationController", { enumerable: true, get: function () { return authentication_controller_1.AuthenticationController; } });
var register_controller_1 = require("./authentication/register.controller");
Object.defineProperty(exports, "RegisterController", { enumerable: true, get: function () { return register_controller_1.RegisterController; } });
var authentication_token_service_1 = require("./authentication/authentication-token.service");
Object.defineProperty(exports, "TokenService", { enumerable: true, get: function () { return authentication_token_service_1.TokenService; } });
var authentication_token_repository_1 = require("./authentication/authentication-token.repository");
Object.defineProperty(exports, "AuthenticationTokenRepository", { enumerable: true, get: function () { return authentication_token_repository_1.AuthenticationTokenRepository; } });
var two_factor_authentication_service_1 = require("./two-factor-authentication/two-factor-authentication.service");
Object.defineProperty(exports, "TwoFactorAuthenticationService", { enumerable: true, get: function () { return two_factor_authentication_service_1.TwoFactorAuthenticationService; } });
var two_factor_authentication_controller_1 = require("./two-factor-authentication/two-factor-authentication.controller");
Object.defineProperty(exports, "TwoFactorAuthenticationController", { enumerable: true, get: function () { return two_factor_authentication_controller_1.TwoFactorAuthenticationController; } });
var two_factor_authentication_repository_1 = require("./two-factor-authentication/two-factor-authentication.repository");
Object.defineProperty(exports, "TwoFactorAuthenticationRepository", { enumerable: true, get: function () { return two_factor_authentication_repository_1.TwoFactorAuthenticationRepository; } });
var password_recovery_service_1 = require("./password-recovery/password-recovery.service");
Object.defineProperty(exports, "PasswordRecoveryService", { enumerable: true, get: function () { return password_recovery_service_1.PasswordRecoveryService; } });
var password_recovery_controller_1 = require("./password-recovery/password-recovery.controller");
Object.defineProperty(exports, "PasswordRecoveryController", { enumerable: true, get: function () { return password_recovery_controller_1.PasswordRecoveryController; } });
var password_recovery_repository_1 = require("./password-recovery/password-recovery.repository");
Object.defineProperty(exports, "PasswordRecoveryRepository", { enumerable: true, get: function () { return password_recovery_repository_1.PasswordRecoveryRepository; } });
Object.defineProperty(exports, "PASSWORD_RECOVERIES_TABLE", { enumerable: true, get: function () { return password_recovery_repository_1.PASSWORD_RECOVERIES_TABLE; } });
var password_recovery_interface_1 = require("./password-recovery/password-recovery.interface");
Object.defineProperty(exports, "RECOVERY_EMAIL", { enumerable: true, get: function () { return password_recovery_interface_1.RECOVERY_EMAIL; } });
Object.defineProperty(exports, "RECOVERY_PHONE", { enumerable: true, get: function () { return password_recovery_interface_1.RECOVERY_PHONE; } });
Object.defineProperty(exports, "TYPES", { enumerable: true, get: function () { return password_recovery_interface_1.TYPES; } });
