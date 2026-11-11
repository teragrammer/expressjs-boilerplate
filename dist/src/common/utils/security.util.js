"use strict";
// src/common/utils/security.util.ts
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SecurityUtil = void 0;
const crypto_1 = __importDefault(require("crypto"));
const bcrypt_1 = __importDefault(require("bcrypt"));
/**
 * Context string for the HKDF key derivation.
 *
 * Binds the derived key to its purpose so the same secret cannot be
 * reused for a different primitive by accident.
 */
const HKDF_CONTEXT = "express-api:cache:v1";
/**
 * Length of the derived AES-256 key in bytes.
 */
const AES_KEY_LENGTH = 32;
class SecurityUtil {
    // Defaults to empty object if no config is injected
    constructor(config = {}) {
        this.config = config;
    }
    /**
     * NO CONFIG REQUIRED: Generates a cryptographically secure random string.
     */
    randomString(size = 32) {
        if (!Number.isInteger(size) || size < 0) {
            throw new Error("Size must be a non-negative integer");
        }
        return crypto_1.default
            .randomBytes(Math.ceil(size / 2))
            .toString("hex")
            .slice(0, size);
    }
    /**
     * NO CONFIG REQUIRED: Generates a CRYPTOGRAPHICALLY SECURE random numeric string.
     */
    randomNumber(length = 6) {
        if (length <= 0) {
            return "";
        }
        let result = "";
        while (result.length < length) {
            const byte = crypto_1.default.randomBytes(1)[0];
            if (byte < 250) { // Keep uniform distribution
                result += (byte % 10).toString();
            }
        }
        return result;
    }
    /**
     * NO CONFIG REQUIRED: Standard Base64 Encoding
     */
    encodeBase64(data) {
        return Buffer.from(data, "utf8").toString("base64");
    }
    /**
     * NO CONFIG REQUIRED: Standard Base64 Decoding
     */
    decodeBase64(data) {
        return Buffer.from(data, "base64").toString("utf8");
    }
    /**
     * NO CONFIG REQUIRED: URL-Safe Base64 Encoding
     */
    encodeUrlBase64(data) {
        return Buffer.from(data, "utf8").toString("base64url");
    }
    /**
     * NO CONFIG REQUIRED: URL-Safe Base64 Decoding
     */
    decodeUrlBase64(data) {
        return Buffer.from(data, "base64url").toString("utf8");
    }
    /**
     * CONFIG OPTIONAL (Requires method parameter if constructor config missing)
     */
    hash(plain, secret) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const pepper = secret !== null && secret !== void 0 ? secret : this.config.bcryptSecret;
            if (!pepper) {
                throw new Error("SecurityUtil Error: A bcrypt secret must be provided via constructor or function parameter.");
            }
            const saltRounds = (_a = this.config.bcryptSaltRounds) !== null && _a !== void 0 ? _a : 10;
            const salt = yield bcrypt_1.default.genSalt(saltRounds);
            return bcrypt_1.default.hash(`${plain}.${pepper}`, salt);
        });
    }
    /**
     * CONFIG OPTIONAL (Requires method parameter if constructor config missing)
     */
    compare(hashed, plain, secret) {
        return __awaiter(this, void 0, void 0, function* () {
            const pepper = secret !== null && secret !== void 0 ? secret : this.config.bcryptSecret;
            if (!pepper) {
                throw new Error("SecurityUtil Error: A bcrypt secret must be provided via constructor or function parameter.");
            }
            return bcrypt_1.default.compare(`${plain}.${pepper}`, hashed);
        });
    }
    /**
     * Derives the 32-byte AES-256 key from the configured secret.
     *
     * HKDF-SHA-256 lets the deployment secret be any length >= 32
     * characters while still producing a key of the exact length
     * AES-256 requires.
     */
    deriveKey(secret) {
        const encryptionSecret = secret !== null && secret !== void 0 ? secret : this.config.cryptoSecret;
        if (!encryptionSecret) {
            throw new Error("SecurityUtil Error: A crypto secret must be provided via constructor or function parameter.");
        }
        if (encryptionSecret.length < 32) {
            throw new Error("SecurityUtil Error: The crypto secret must be at least 32 characters.");
        }
        return Buffer.from(crypto_1.default.hkdfSync("sha256", Buffer.from(encryptionSecret, "utf-8"), Buffer.alloc(0), Buffer.from(HKDF_CONTEXT, "utf-8"), AES_KEY_LENGTH));
    }
    /**
     * CONFIG OPTIONAL (Requires method parameter if constructor config missing)
     *
     * Authenticated encryption using AES-256-GCM.
     */
    encrypt(data, secret) {
        var _a;
        const key = this.deriveKey(secret);
        const cipherAlgorithm = (_a = this.config.cryptoCipher) !== null && _a !== void 0 ? _a : "aes-256-gcm";
        const iv = crypto_1.default.randomBytes(12); // GCM standard IV size is 12 bytes
        const cipher = crypto_1.default.createCipheriv(cipherAlgorithm, key, iv);
        const encrypted = Buffer.concat([cipher.update(data, "utf8"), cipher.final()]);
        const authTag = cipher.getAuthTag();
        // Format: version:iv_hex:auth_tag_hex:encrypted_payload_hex
        return `v1:${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
    }
    /**
     * CONFIG OPTIONAL (Requires method parameter if constructor config missing)
     *
     * Decrypts an AES-256-GCM encrypted payload and verifies integrity.
     */
    decrypt(encryptedPayload, secret) {
        var _a;
        const key = this.deriveKey(secret);
        const cipherAlgorithm = (_a = this.config.cryptoCipher) !== null && _a !== void 0 ? _a : "aes-256-gcm";
        const parts = encryptedPayload.split(":");
        if (parts.length !== 4 || parts[0] !== "v1") {
            throw new Error("Invalid encrypted payload structure");
        }
        const iv = Buffer.from(parts[1], "hex");
        const authTag = Buffer.from(parts[2], "hex");
        const encryptedText = Buffer.from(parts[3], "hex");
        const decipher = crypto_1.default.createDecipheriv(cipherAlgorithm, key, iv);
        decipher.setAuthTag(authTag);
        const decrypted = Buffer.concat([decipher.update(encryptedText), decipher.final()]);
        return decrypted.toString("utf8");
    }
    /**
     * Encrypts a payload for the cache.
     *
     * AES-256-GCM already provides confidentiality and integrity, so
     * no additional password hashing is performed. The previous
     * implementation ran bcrypt on every cache read and write, which
     * cost hundreds of milliseconds per operation and made the cache
     * slower than the database.
     */
    shield(data) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.encrypt(data);
        });
    }
    /**
     * Decrypts and verifies a cache payload.
     */
    unshield(message) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.decrypt(message);
        });
    }
}
exports.SecurityUtil = SecurityUtil;
