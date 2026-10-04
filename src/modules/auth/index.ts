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

export {AuthenticationService} from "./authentication/authentication.service";
export {AuthenticationController} from "./authentication/authentication.controller";
export {RegisterController} from "./authentication/register.controller";
export {TokenService} from "./authentication/authentication-token.service";
export {AuthenticationTokenRepository} from "./authentication/authentication-token.repository";

export {TwoFactorAuthenticationService} from "./two-factor-authentication/two-factor-authentication.service";
export {TwoFactorAuthenticationController} from "./two-factor-authentication/two-factor-authentication.controller";
export {TwoFactorAuthenticationRepository} from "./two-factor-authentication/two-factor-authentication.repository";

export {PasswordRecoveryService} from "./password-recovery/password-recovery.service";
export {PasswordRecoveryController} from "./password-recovery/password-recovery.controller";
export {PasswordRecoveryRepository, PASSWORD_RECOVERIES_TABLE} from "./password-recovery/password-recovery.repository";

export type {
    LoginInput,
    RegisterInput,
    AuthenticationToken,
    CreateAuthenticationTokenInput,
    UpdateAuthenticationTokenInput,
    JwtExtendedPayload,
} from "./authentication/authentication.interface";

export type {
    TwoFactorAuthentication,
    SendOtpInput,
    SendOtpResult,
    VerifyOtpInput,
} from "./two-factor-authentication/two-factor-authentication.interface";

export {
    RECOVERY_EMAIL,
    RECOVERY_PHONE,
    TYPES,
} from "./password-recovery/password-recovery.interface";

export type {
    Type as PasswordRecoveryType,
    PasswordRecovery,
    PasswordRecoveryCreateData,
    PasswordRecoveryResult,
    PasswordRecoverySendRequest,
    PasswordRecoveryValidateRequest,
} from "./password-recovery/password-recovery.interface";
