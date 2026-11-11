// src/config/container.ts
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
import {AuthenticationTokenRepository} from "../modules/auth/authentication/authentication-token.repository";
import {RefreshTokenRepository} from "../modules/auth/authentication/refresh-token.repository";
import {RoleRepository} from "../modules/system/roles/role.repository";
import {UserRepository} from "../modules/users/user.repository";
import {PasswordRecoveryRepository} from "../modules/auth/password-recovery/password-recovery.repository";
import {VerificationRepository} from "../modules/auth/verification/verification.repository";
import {AuditRepository} from "../modules/audit/audit.repository";
import {OutboxRepository} from "../modules/jobs/outbox.repository";

// Shared Cache Elements
import {RedisCache} from "../shared/redis/redis-cache";
import {RedisSubscriber} from "../shared/redis/redis-subscriber";

// Services
import {SettingService} from "../modules/system/settings/setting.service";
import {RouteGuardService} from "../modules/system/route-guards/route-guard.service";
import {UserService} from "../modules/users/services/user.service";
import {AuthenticationService} from "../modules/auth/authentication/authentication.service";
import {TokenService} from "../modules/auth/authentication/authentication-token.service";
import {SessionService} from "../modules/auth/authentication/session.service";
import {TwoFactorAuthenticationService} from "../modules/auth/two-factor-authentication/two-factor-authentication.service";
import {PasswordRecoveryService} from "../modules/auth/password-recovery/password-recovery.service";
import {RoleService} from "../modules/system/roles/role.service";
import {AccountService} from "../modules/users/services/account.service";
import {UserPurgeService} from "../modules/users/services/user-purge.service";
import {VerificationService} from "../modules/auth/verification/verification.service";
import {AuditService} from "../modules/audit/audit.service";

// Jobs
import {OutboxWorker} from "../modules/jobs/outbox.worker";
import {CleanupJob} from "../modules/jobs/cleanup.job";
import {OUTBOX_TYPES} from "../modules/jobs/outbox.interface";

// Event Handlers
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
const roleService = new RoleService(new RoleRepository());
const dateUtil = new DateUtil();

export const userService = new UserService(
    userRepository,
    securityUtil,
    authenticationTokenRepository,
);
export const tokenService = new TokenService();

// Application services
export const settingService = new SettingService(
    settingRepository,
    redisCache,
);

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

export const auditService = new AuditService(auditRepository);

// TwoFactorAuthenticationService must be created before AuthenticationService
export const twoFactorAuthenticationService = new TwoFactorAuthenticationService(
    securityUtil,
    new TwoFactorAuthenticationRepository(db),
    authenticationTokenRepository,
    tokenService,
    dateUtil,
    settingService,
    mailService,
    roleService,
    userRepository,
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

const passwordRecoveryRepository =
    new PasswordRecoveryRepository(db);

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
        };

        if (!payload.to) {
            throw new Error(
                "Outbox email event is missing the recipient.",
            );
        }

        await mailService.send({
            to: payload.to,
            from: payload.from ?? __ENV.MAIL_FROM_ADDRESS,
            subject: payload.subject ?? "",
            text: payload.text,
            html: payload.html,
        });
    },
);
