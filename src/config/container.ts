// src/config/container.ts
/*
 * Composition root.
 *
 * Every repository, service, controller and background worker used by
 * the application is constructed here exactly once. Route factories
 * import the instances from this module; they must not construct their
 * own dependency graphs.
 */
import {db} from "./database";
import {DBRedis} from "./redis";
import {logger} from "./logger";
import {__ENV} from "./environment";
import {SecurityUtil} from "../common/utils/security.util";
import {DateUtil} from "../common/utils/date.util";

// Repositories
import {SettingRepository} from "../modules/system/settings/setting.repository";
import {RouteGuardRepository} from "../modules/system/route-guards/route-guard.repository";
import {TwoFactorAuthenticationRepository} from "../modules/auth/two-factor-authentication/two-factor-authentication.repository";
import {TfaRecoveryCodeRepository} from "../modules/auth/two-factor-authentication/tfa-recovery-code.repository";
import {AuthenticationTokenRepository} from "../modules/auth/authentication/authentication-token.repository";
import {RefreshTokenRepository} from "../modules/auth/authentication/refresh-token.repository";
import {RoleRepository} from "../modules/system/roles/role.repository";
import {UserRepository} from "../modules/users/user.repository";
import {PasswordRecoveryRepository} from "../modules/auth/password-recovery/password-recovery.repository";
import {VerificationRepository} from "../modules/auth/verification/verification.repository";
import {AuditRepository} from "../modules/audit/audit.repository";
import {OutboxRepository} from "../modules/jobs/outbox.repository";

// Shared cache elements
import {RedisCache} from "../shared/redis/redis-cache";
import {RedisSubscriber} from "../shared/redis/redis-subscriber";

// Services
import {SettingService} from "../modules/system/settings/setting.service";
import {RouteGuardService} from "../modules/system/route-guards/route-guard.service";
import {UserService} from "../modules/users/user.service";
import {AuthenticationService} from "../modules/auth/authentication/authentication.service";
import {TokenService} from "../modules/auth/authentication/authentication-token.service";
import {SessionService} from "../modules/auth/authentication/session.service";
import {TwoFactorAuthenticationService} from "../modules/auth/two-factor-authentication/two-factor-authentication.service";
import {PasswordRecoveryService} from "../modules/auth/password-recovery/password-recovery.service";
import {RoleService} from "../modules/system/roles/role.service";
import {AccountService} from "../modules/users/account.service";
import {UserPurgeService} from "../modules/users/user-purge.service";
import {VerificationService} from "../modules/auth/verification/verification.service";
import {AuditService} from "../modules/audit/audit.service";
import {HealthService} from "../modules/system/health/health.service";

// Controllers
import {AuthenticationController} from "../modules/auth/authentication/authentication.controller";
import {AuthenticationRefreshController} from "../modules/auth/authentication/authentication-refresh.controller";
import {RegisterController} from "../modules/auth/authentication/register.controller";
import {PasswordRecoveryController} from "../modules/auth/password-recovery/password-recovery.controller";
import {TwoFactorAuthenticationController} from "../modules/auth/two-factor-authentication/two-factor-authentication.controller";
import {VerificationController} from "../modules/auth/verification/verification.controller";
import {AuditController} from "../modules/audit/audit.controller";
import {AccountController} from "../modules/users/account.controller";
import {UserController} from "../modules/users/user.controller";
import {RoleController} from "../modules/system/roles/role.controller";
import {SettingController} from "../modules/system/settings/setting.controller";
import {RouteGuardController} from "../modules/system/route-guards/route-guard.controller";

// Jobs
import {OutboxWorker} from "../modules/jobs/outbox.worker";
import {CleanupJob} from "../modules/jobs/cleanup.job";
import {OUTBOX_TYPES} from "../modules/jobs/outbox.interface";

// Event handlers
import {SystemEventHandler} from "../modules/system/settings/system.event";
import {SendGridMailService} from "../infrastructure/mail/sendgrid-mail.service";

export const securityUtil = new SecurityUtil({
    bcryptSecret: __ENV.BCRYPT_SECRET,
    bcryptSaltRounds: Number(__ENV.BCRYPT_SALT_ROUND || 10),
    cryptoSecret: __ENV.CRYPT0_SECRET,
    cryptoCipher: __ENV.CRYPT0_CIPHER,
});

export const redisCache = new RedisCache(
    DBRedis,
    securityUtil,
    logger,
);

export const redisSubscriber = new RedisSubscriber(
    DBRedis,
    logger,
);

// Repositories
const userRepository = new UserRepository(db);
const settingRepository = new SettingRepository(db);
const routeGuardRepository = new RouteGuardRepository(db);
const authenticationTokenRepository = new AuthenticationTokenRepository(db);
const refreshTokenRepository = new RefreshTokenRepository(db);
export {refreshTokenRepository};
const verificationRepository = new VerificationRepository(db);
const auditRepository = new AuditRepository(db);
export const outboxRepository = new OutboxRepository(db);
const passwordRecoveryRepository = new PasswordRecoveryRepository(db);
const dateUtil = new DateUtil();

// Application services
export const userService = new UserService(
    userRepository,
    securityUtil,
    authenticationTokenRepository,
    undefined,
    refreshTokenRepository,
);
export const tokenService = new TokenService();

export const settingService = new SettingService(
    settingRepository,
    redisCache,
);

export const roleService = new RoleService(new RoleRepository(db));
export const auditService = new AuditService(auditRepository);
export const healthService = new HealthService();

// Mail provider (needed for TwoFactorAuthenticationService)
const mailService = new SendGridMailService(
    __ENV.SENDGRID_API_KEY,
);

/**
 * Session authority.
 *
 * Every access/refresh token pair is issued here, which keeps a single
 * token contract across login, registration and refresh.
 */
export const sessionService = new SessionService(
    authenticationTokenRepository,
    refreshTokenRepository,
    tokenService,
    roleService,
    userRepository,
    dateUtil,
);

export const verificationService = new VerificationService(
    securityUtil,
    verificationRepository,
    userRepository,
    settingService,
    outboxRepository,
    mailService,
    dateUtil,
);

// TwoFactorAuthenticationService must be created before AuthenticationService
export const twoFactorAuthenticationService = new TwoFactorAuthenticationService(
    securityUtil,
    new TwoFactorAuthenticationRepository(db),
    authenticationTokenRepository,
    dateUtil,
    settingService,
    mailService,
    roleService,
    userRepository,
    sessionService,
    new TfaRecoveryCodeRepository(db),
    refreshTokenRepository,
);

export const authService = new AuthenticationService(
    securityUtil,
    authenticationTokenRepository,
    roleService,
    userService,
    userRepository,
    tokenService,
    dateUtil,
    settingService,
    twoFactorAuthenticationService,
    sessionService,
);

export const routeGuardService = new RouteGuardService(
    routeGuardRepository,
    redisCache,
);

export const passwordRecoveryService =
    new PasswordRecoveryService(
        securityUtil,
        passwordRecoveryRepository,
        userRepository,
        settingService,
        mailService,
        authenticationTokenRepository,
        dateUtil,
        outboxRepository,
        verificationService,
    );

export const accountService = new AccountService(
    userRepository,
    securityUtil,
    authenticationTokenRepository,
    roleService,
    dateUtil,
    sessionService,
    verificationService,
    passwordRecoveryRepository,
);

export const userPurgeService = new UserPurgeService(
    userRepository,
    authenticationTokenRepository,
    auditService,
);

export const systemEventHandler = new SystemEventHandler(
    redisCache,
    settingService,
    routeGuardService,
);

// Controllers
export const authenticationController = new AuthenticationController(
    authService,
    sessionService,
    refreshTokenRepository,
    auditService,
);

export const authenticationRefreshController =
    new AuthenticationRefreshController(sessionService, auditService);

export const registerController = new RegisterController(
    authService,
    auditService,
);

export const passwordRecoveryController = new PasswordRecoveryController(
    passwordRecoveryService,
);

export const twoFactorAuthenticationController =
    new TwoFactorAuthenticationController(
        twoFactorAuthenticationService,
        auditService,
    );

export const verificationController = new VerificationController(
    verificationService,
);

export const auditController = new AuditController(auditService);

export const accountController = new AccountController(accountService);

export const userController = new UserController(
    userService,
    userPurgeService,
    auditService,
);

export const roleController = new RoleController(roleService, auditService);
export const settingController = new SettingController(
    settingService,
    auditService,
);
export const routeGuardController = new RouteGuardController(
    routeGuardService,
);

// Background jobs
export const outboxWorker = new OutboxWorker(outboxRepository);
export const cleanupJob = new CleanupJob();

/*
 * Outbox handlers.
 *
 * Email delivery is the only handler that talks to an external
 * provider; it runs in the worker so a request never waits on (or
 * fails because of) the mail provider.
 */
outboxWorker.register(
    OUTBOX_TYPES.SEND_EMAIL,
    async ({event}) => {
        const payload = event.payload as {
            to?: string;
            from?: string;
            subject?: string;
            text?: string;
            html?: string;
            encrypted?: boolean;
        };

        if (!payload.to) {
            throw new Error(
                "Outbox email event is missing the recipient.",
            );
        }

        /*
         * One-time codes are encrypted at rest. Decrypt only at the
         * delivery boundary so the plaintext never lives in the table
         * or in a database backup.
         */
        const text =
            payload.encrypted === true && typeof payload.text === "string"
                ? securityUtil.decrypt(payload.text)
                : payload.text;

        await mailService.send({
            to: payload.to,
            from: payload.from ?? __ENV.MAIL_FROM_ADDRESS,
            subject: payload.subject ?? "",
            text,
            html: payload.html,
        });
    },
);
