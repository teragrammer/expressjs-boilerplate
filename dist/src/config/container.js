"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanupJob = exports.outboxWorker = exports.systemEventHandler = exports.accountService = exports.passwordRecoveryService = exports.routeGuardService = exports.authService = exports.twoFactorAuthenticationService = exports.auditService = exports.verificationService = exports.sessionService = exports.settingService = exports.tokenService = exports.userService = exports.outboxRepository = exports.refreshTokenRepository = exports.redisSubscriber = exports.redisCache = exports.securityUtil = void 0;
// src/config/container.ts
const database_1 = require("./database");
const redis_1 = require("./redis");
const logger_1 = require("./logger");
const environment_1 = require("./environment");
const security_util_1 = require("../common/utils/security.util");
const date_util_1 = require("../common/utils/date.util");
// Repositories
const setting_repository_1 = require("../modules/system/settings/setting.repository");
const route_guard_repository_1 = require("../modules/system/route-guards/route-guard.repository");
const two_factor_authentication_repository_1 = require("../modules/auth/two-factor-authentication/two-factor-authentication.repository");
const authentication_token_repository_1 = require("../modules/auth/authentication/authentication-token.repository");
const refresh_token_repository_1 = require("../modules/auth/authentication/refresh-token.repository");
const role_repository_1 = require("../modules/system/roles/role.repository");
const user_repository_1 = require("../modules/users/user.repository");
const password_recovery_repository_1 = require("../modules/auth/password-recovery/password-recovery.repository");
const verification_repository_1 = require("../modules/auth/verification/verification.repository");
const audit_repository_1 = require("../modules/audit/audit.repository");
const outbox_repository_1 = require("../modules/jobs/outbox.repository");
// Shared Cache Elements
const redis_cache_1 = require("../shared/redis/redis-cache");
const redis_subscriber_1 = require("../shared/redis/redis-subscriber");
// Services
const setting_service_1 = require("../modules/system/settings/setting.service");
const route_guard_service_1 = require("../modules/system/route-guards/route-guard.service");
const user_service_1 = require("../modules/users/services/user.service");
const authentication_service_1 = require("../modules/auth/authentication/authentication.service");
const authentication_token_service_1 = require("../modules/auth/authentication/authentication-token.service");
const session_service_1 = require("../modules/auth/authentication/session.service");
const two_factor_authentication_service_1 = require("../modules/auth/two-factor-authentication/two-factor-authentication.service");
const password_recovery_service_1 = require("../modules/auth/password-recovery/password-recovery.service");
const role_service_1 = require("../modules/system/roles/role.service");
const account_service_1 = require("../modules/users/services/account.service");
const verification_service_1 = require("../modules/auth/verification/verification.service");
const audit_service_1 = require("../modules/audit/audit.service");
// Jobs
const outbox_worker_1 = require("../modules/jobs/outbox.worker");
const cleanup_job_1 = require("../modules/jobs/cleanup.job");
const outbox_interface_1 = require("../modules/jobs/outbox.interface");
// Event Handlers
const system_event_1 = require("../modules/system/settings/system.event");
const sendgrid_mail_service_1 = require("../infrastructure/mail/sendgrid-mail.service");
exports.securityUtil = new security_util_1.SecurityUtil({
    bcryptSecret: environment_1.__ENV.BCRYPT_SECRET,
    bcryptSaltRounds: Number(environment_1.__ENV.BCRYPT_SALT_ROUND || 10),
    cryptoSecret: environment_1.__ENV.CRYPT0_SECRET,
    cryptoCipher: environment_1.__ENV.CRYPT0_CIPHER,
});
exports.redisCache = new redis_cache_1.RedisCache(redis_1.DBRedis, exports.securityUtil, logger_1.logger);
exports.redisSubscriber = new redis_subscriber_1.RedisSubscriber(redis_1.DBRedis, logger_1.logger);
// Repositories
const userRepository = new user_repository_1.UserRepository(database_1.db);
const settingRepository = new setting_repository_1.SettingRepository(database_1.db);
const routeGuardRepository = new route_guard_repository_1.RouteGuardRepository(database_1.db);
const authenticationTokenRepository = new authentication_token_repository_1.AuthenticationTokenRepository(database_1.db);
const refreshTokenRepository = new refresh_token_repository_1.RefreshTokenRepository(database_1.db);
exports.refreshTokenRepository = refreshTokenRepository;
const verificationRepository = new verification_repository_1.VerificationRepository(database_1.db);
const auditRepository = new audit_repository_1.AuditRepository(database_1.db);
exports.outboxRepository = new outbox_repository_1.OutboxRepository(database_1.db);
const roleService = new role_service_1.RoleService(new role_repository_1.RoleRepository());
const dateUtil = new date_util_1.DateUtil();
exports.userService = new user_service_1.UserService(userRepository, exports.securityUtil);
exports.tokenService = new authentication_token_service_1.TokenService();
// Application services
exports.settingService = new setting_service_1.SettingService(settingRepository, exports.redisCache);
// Mail provider (needed for TwoFactorAuthenticationService)
const mailService = new sendgrid_mail_service_1.SendGridMailService(environment_1.__ENV.SENDGRID_API_KEY);
/**
 * Session authority.
 *
 * Every access/refresh token pair is issued here, which keeps a single
 * token contract across login, registration and refresh.
 */
exports.sessionService = new session_service_1.SessionService(authenticationTokenRepository, refreshTokenRepository, exports.tokenService, roleService, userRepository, dateUtil);
exports.verificationService = new verification_service_1.VerificationService(exports.securityUtil, verificationRepository, userRepository, exports.settingService, exports.outboxRepository, mailService, dateUtil);
exports.auditService = new audit_service_1.AuditService(auditRepository);
// TwoFactorAuthenticationService must be created before AuthenticationService
exports.twoFactorAuthenticationService = new two_factor_authentication_service_1.TwoFactorAuthenticationService(exports.securityUtil, new two_factor_authentication_repository_1.TwoFactorAuthenticationRepository(database_1.db), authenticationTokenRepository, exports.tokenService, dateUtil, exports.settingService, mailService, roleService, userRepository);
exports.authService = new authentication_service_1.AuthenticationService(exports.securityUtil, authenticationTokenRepository, roleService, exports.userService, userRepository, exports.tokenService, dateUtil, exports.settingService, exports.twoFactorAuthenticationService, exports.sessionService);
const passwordRecoveryRepository = new password_recovery_repository_1.PasswordRecoveryRepository(database_1.db);
exports.routeGuardService = new route_guard_service_1.RouteGuardService(routeGuardRepository, exports.redisCache);
exports.passwordRecoveryService = new password_recovery_service_1.PasswordRecoveryService(exports.securityUtil, passwordRecoveryRepository, userRepository, exports.settingService, mailService, authenticationTokenRepository, dateUtil, exports.outboxRepository, exports.verificationService);
exports.accountService = new account_service_1.AccountService(userRepository, exports.securityUtil, authenticationTokenRepository, roleService, dateUtil, exports.sessionService, exports.verificationService, passwordRecoveryRepository);
exports.systemEventHandler = new system_event_1.SystemEventHandler(exports.redisCache, exports.settingService, exports.routeGuardService);
// Background jobs
exports.outboxWorker = new outbox_worker_1.OutboxWorker(exports.outboxRepository);
exports.cleanupJob = new cleanup_job_1.CleanupJob();
/*
 * Outbox handlers.
 *
 * Email delivery is the only handler that talks to an external
 * provider; it runs in the worker so a request never waits on (or
 * fails because of) the mail provider.
 */
exports.outboxWorker.register(outbox_interface_1.OUTBOX_TYPES.SEND_EMAIL, (_a) => __awaiter(void 0, [_a], void 0, function* ({ event }) {
    var _b, _c;
    const payload = event.payload;
    if (!payload.to) {
        throw new Error("Outbox email event is missing the recipient.");
    }
    yield mailService.send({
        to: payload.to,
        from: (_b = payload.from) !== null && _b !== void 0 ? _b : environment_1.__ENV.MAIL_FROM_ADDRESS,
        subject: (_c = payload.subject) !== null && _c !== void 0 ? _c : "",
        text: payload.text,
        html: payload.html,
    });
}));
