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
     * NO CONFIG REQUIRED: Generates a cryptographically SECURE random numeric string.
     */
    randomNumber(length = 6) {
        if (length <= 0) {
            return "";
        }
        let result = "";
        while (result.length < length) {
            const byte = crypto_1.default.randomBytes(1)[0];
            if (byte < 250) { // Ensures uniform distribution (250 is multiple of 10)
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
     * CONFIG OPTIONAL: Authenticated Encryption using AES-256-GCM.
     */
    encrypt(data, secret) {
        var _a;
        const encryptionSecret = secret !== null && secret !== void 0 ? secret : this.config.cryptoSecret;
        if (!encryptionSecret) {
            throw new Error("SecurityUtil Error: A crypto secret must be provided via constructor or function parameter.");
        }
        const cipherAlgorithm = (_a = this.config.cryptoCipher) !== null && _a !== void 0 ? _a : "aes-256-gcm";
        const iv = crypto_1.default.randomBytes(12); // GCM standard IV size is 12 bytes
        const cipher = crypto_1.default.createCipheriv(cipherAlgorithm, Buffer.from(encryptionSecret, "utf-8"), iv);
        const encrypted = Buffer.concat([cipher.update(data, "utf8"), cipher.final()]);
        const authTag = cipher.getAuthTag();
        // Format: iv_hex:auth_tag_hex:encrypted_payload_hex
        return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
    }
    /**
     * CONFIG OPTIONAL: Decrypts AES-256-GCM encrypted payload and verifies integrity.
     */
    decrypt(encryptedPayload, secret) {
        var _a;
        const decryptionSecret = secret !== null && secret !== void 0 ? secret : this.config.cryptoSecret;
        if (!decryptionSecret) {
            throw new Error("SecurityUtil Error: A crypto secret must be provided via constructor or function parameter.");
        }
        const [ivHex, authTagHex, encryptedTextHex] = encryptedPayload.split(":");
        if (!ivHex || !authTagHex || !encryptedTextHex) {
            throw new Error("Invalid encrypted payload structure");
        }
        const iv = Buffer.from(ivHex, "hex");
        const authTag = Buffer.from(authTagHex, "hex");
        const encryptedText = Buffer.from(encryptedTextHex, "hex");
        const cipherAlgorithm = (_a = this.config.cryptoCipher) !== null && _a !== void 0 ? _a : "aes-256-gcm";
        const decipher = crypto_1.default.createDecipheriv(cipherAlgorithm, Buffer.from(decryptionSecret, "utf-8"), iv);
        decipher.setAuthTag(authTag);
        const decrypted = Buffer.concat([decipher.update(encryptedText), decipher.final()]);
        return decrypted.toString("utf8");
    }
    /**
     * CONFIG REQUIRED (Unless local parameters are handled inside individual steps)
     */
    shield(data) {
        return __awaiter(this, void 0, void 0, function* () {
            const hashedData = yield this.hash(data);
            const encryptedData = this.encrypt(data);
            const payload = JSON.stringify({
                data: encryptedData,
                hashed: hashedData,
            });
            return this.encodeUrlBase64(payload);
        });
    }
    /**
     * CONFIG REQUIRED (Unless local parameters are handled inside individual steps)
     */
    unshield(message) {
        return __awaiter(this, void 0, void 0, function* () {
            const decodedMessage = this.decodeUrlBase64(message);
            const parsedPayload = JSON.parse(decodedMessage);
            const decryptedData = this.decrypt(parsedPayload.data);
            const isValid = yield this.compare(parsedPayload.hashed, decryptedData);
            if (!isValid) {
                throw new Error("Data integrity check failed");
            }
            return decryptedData;
        });
    }
}
exports.SecurityUtil = SecurityUtil;
