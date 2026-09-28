// src/common/utils/security.util.ts

import crypto from "crypto";
import bcrypt from "bcrypt";

export interface SecurityConfig {
    bcryptSecret?: string;
    bcryptSaltRounds?: number;
    cryptoSecret?: string; // Must be 32 bytes for aes-256-gcm
    cryptoCipher?: string;
}

export class SecurityUtil {
    private readonly config: SecurityConfig;

    // Defaults to empty object if no config is injected
    constructor(config: SecurityConfig = {}) {
        this.config = config;
    }

    /**
     * NO CONFIG REQUIRED: Generates a cryptographically secure random string.
     */
    public randomString(size: number = 32): string {
        if (!Number.isInteger(size) || size < 0) {
            throw new Error("Size must be a non-negative integer");
        }

        return crypto
            .randomBytes(Math.ceil(size / 2))
            .toString("hex")
            .slice(0, size);
    }

    /**
     * NO CONFIG REQUIRED: Generates a cryptographically SECURE random numeric string.
     */
    public randomNumber(length: number = 6): string {
        if (length <= 0) return "";
        let result = "";
        while (result.length < length) {
            const byte = crypto.randomBytes(1)[0];
            if (byte < 250) { // Ensures uniform distribution (250 is multiple of 10)
                result += (byte % 10).toString();
            }
        }
        return result;
    }

    /**
     * NO CONFIG REQUIRED: Standard Base64 Encoding
     */
    public encodeBase64(data: string): string {
        return Buffer.from(data, "utf8").toString("base64");
    }

    /**
     * NO CONFIG REQUIRED: Standard Base64 Decoding
     */
    public decodeBase64(data: string): string {
        return Buffer.from(data, "base64").toString("utf8");
    }

    /**
     * NO CONFIG REQUIRED: URL-Safe Base64 Encoding
     */
    public encodeUrlBase64(data: string): string {
        return Buffer.from(data, "utf8").toString("base64url");
    }

    /**
     * NO CONFIG REQUIRED: URL-Safe Base64 Decoding
     */
    public decodeUrlBase64(data: string): string {
        return Buffer.from(data, "base64url").toString("utf8");
    }

    /**
     * CONFIG OPTIONAL (Requires method parameter if constructor config missing)
     */
    public async hash(plain: string, secret?: string): Promise<string> {
        const pepper = secret ?? this.config.bcryptSecret;
        if (!pepper) {
            throw new Error("SecurityUtil Error: A bcrypt secret must be provided via constructor or function parameter.");
        }
        const saltRounds = this.config.bcryptSaltRounds ?? 10;
        const salt = await bcrypt.genSalt(saltRounds);
        return bcrypt.hash(`${plain}.${pepper}`, salt);
    }

    /**
     * CONFIG OPTIONAL (Requires method parameter if constructor config missing)
     */
    public async compare(hashed: string, plain: string, secret?: string): Promise<boolean> {
        const pepper = secret ?? this.config.bcryptSecret;
        if (!pepper) {
            throw new Error("SecurityUtil Error: A bcrypt secret must be provided via constructor or function parameter.");
        }
        return bcrypt.compare(`${plain}.${pepper}`, hashed);
    }

    /**
     * CONFIG OPTIONAL: Authenticated Encryption using AES-256-GCM.
     */
    public encrypt(data: string, secret?: string): string {
        const encryptionSecret = secret ?? this.config.cryptoSecret;
        if (!encryptionSecret) {
            throw new Error("SecurityUtil Error: A crypto secret must be provided via constructor or function parameter.");
        }

        const cipherAlgorithm = this.config.cryptoCipher ?? "aes-256-gcm";
        const iv = crypto.randomBytes(12); // GCM standard IV size is 12 bytes

        const cipher = crypto.createCipheriv(
            cipherAlgorithm,
            Buffer.from(encryptionSecret, "utf-8"),
            iv
        ) as crypto.CipherGCM;

        const encrypted = Buffer.concat([cipher.update(data, "utf8"), cipher.final()]);
        const authTag = cipher.getAuthTag();

        // Format: iv_hex:auth_tag_hex:encrypted_payload_hex
        return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
    }

    /**
     * CONFIG OPTIONAL: Decrypts AES-256-GCM encrypted payload and verifies integrity.
     */
    public decrypt(encryptedPayload: string, secret?: string): string {
        const decryptionSecret = secret ?? this.config.cryptoSecret;
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
        const cipherAlgorithm = this.config.cryptoCipher ?? "aes-256-gcm";

        const decipher = crypto.createDecipheriv(
            cipherAlgorithm,
            Buffer.from(decryptionSecret, "utf-8"),
            iv
        ) as crypto.DecipherGCM;

        decipher.setAuthTag(authTag);

        const decrypted = Buffer.concat([decipher.update(encryptedText), decipher.final()]);
        return decrypted.toString("utf8");
    }

    /**
     * CONFIG REQUIRED (Unless local parameters are handled inside individual steps)
     */
    public async shield(data: string): Promise<string> {
        const hashedData = await this.hash(data);
        const encryptedData = this.encrypt(data);

        const payload = JSON.stringify({
            data: encryptedData,
            hashed: hashedData,
        });

        return this.encodeUrlBase64(payload);
    }

    /**
     * CONFIG REQUIRED (Unless local parameters are handled inside individual steps)
     */
    public async unshield(message: string): Promise<string> {
        const decodedMessage = this.decodeUrlBase64(message);
        const parsedPayload = JSON.parse(decodedMessage);
        const decryptedData = this.decrypt(parsedPayload.data);

        const isValid = await this.compare(parsedPayload.hashed, decryptedData);
        if (!isValid) {
            throw new Error("Data integrity check failed");
        }

        return decryptedData;
    }
}