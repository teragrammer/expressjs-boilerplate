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
exports.RedisCache = void 0;
class RedisCache {
    constructor(dbRedis, securityUtil, logger) {
        this.securityUtil = securityUtil;
        this.logger = logger;
        this.publisher = dbRedis.publisher;
        // The cache engine only needs the publisher to be defined and active
        this.isEnabled = dbRedis.publisher !== undefined;
    }
    /**
     * Checks if the write/read cache connection is healthy
     */
    isConnected() {
        if (!this.isEnabled || !this.publisher) {
            return false;
        }
        return this.publisher.status === "ready" || this.publisher.status === "connect";
    }
    /**
     * Securely retrieves and decrypts data from Redis
     */
    get(key) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (!this.isConnected() || !this.publisher) {
                    return null;
                }
                const securedData = yield this.publisher.get(key);
                if (!securedData) {
                    return null;
                }
                const decryptedData = yield this.securityUtil.unshield(securedData);
                return JSON.parse(decryptedData);
            }
            catch (err) {
                this.logger.error(`Redis secure read failed for key ${key}: ${err.message}`);
                return null;
            }
        });
    }
    /**
     * Securely encrypts, stores, and publishes changes to a Redis key/channel
     */
    set(key, value, ttlSeconds) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (!this.isConnected() || !this.publisher) {
                    return;
                }
                const rawString = JSON.stringify(value);
                const encryptedPayload = yield this.securityUtil.shield(rawString);
                // Save encrypted value
                if (ttlSeconds) {
                    yield this.publisher.set(key, encryptedPayload, "EX", ttlSeconds);
                }
                else {
                    yield this.publisher.set(key, encryptedPayload);
                }
                // Notify subscriber processes of the change (Pub/Sub)
                yield this.publisher.publish(key, "updated");
                this.logger.info(`Redis secure write & publish successful for key: ${key}`);
            }
            catch (err) {
                this.logger.error(`Redis secure write failed for key ${key}: ${err.message}`);
            }
        });
    }
}
exports.RedisCache = RedisCache;
