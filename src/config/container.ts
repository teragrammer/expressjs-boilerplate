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
import {RoleRepository} from "../modules/system/roles/role.repository";
import {UserRepository} from "../modules/users/user.repository";
import {PasswordRecoveryRepository} from "../modules/auth/password-recovery/password-recovery.repository";

// Shared Cache Elements
import {RedisCache} from "../shared/redis/redis-cache";
import {RedisSubscriber} from "../shared/redis/redis-subscriber";

// Services
import {SettingService} from "../modules/system/settings/setting.service";
import {RouteGuardService} from "../modules/system/route-guards/route-guard.service";
import {UserService} from "../modules/users/services/user.service";
import {AuthenticationService} from "../modules/auth/authentication/authentication.service";
import {TokenService} from "../modules/auth/authentication/authentication-token.service";
import {TwoFactorAuthenticationService} from "../modules/auth/two-factor-authentication/two-factor-authentication.service";
import {PasswordRecoveryService} from "../modules/auth/password-recovery/password-recovery.service";
import {RoleService} from "../modules/system/roles/role.service";

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
const roleService = new RoleService(new RoleRepository());
const dateUtil = new DateUtil();

export const userService = new UserService(userRepository, securityUtil);
export const tokenService = new TokenService();

// Application services
export const settingService = new SettingService(
    settingRepository,
    redisCache,
);

export const authService = new AuthenticationService(securityUtil, authenticationTokenRepository, roleService, userService, userRepository, tokenService, dateUtil, settingService);

// Mail provider
const mailService = new SendGridMailService(
    __ENV.SENDGRID_API_KEY,
);

const passwordRecoveryRepository =
    new PasswordRecoveryRepository(db);

export const routeGuardService = new RouteGuardService(
    routeGuardRepository,
    redisCache,
);

export const twoFactorAuthenticationService = new TwoFactorAuthenticationService(
    securityUtil,
    new TwoFactorAuthenticationRepository(db),
    authenticationTokenRepository,
    tokenService,
    dateUtil,
    settingService,
    mailService,
);

export const passwordRecoveryService =
    new PasswordRecoveryService(
        securityUtil,
        passwordRecoveryRepository,
        userRepository,
        settingService,
        mailService,
    );

export const systemEventHandler = new SystemEventHandler(
    redisCache,
    settingService,
    routeGuardService,
);