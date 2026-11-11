// src/common/utils/security.util.ts

import crypto from "crypto";
import bcrypt from "bcrypt";
import {createHash} from "crypto";

export interface SecurityConfig {
    bcryptSecret?: string;
    bcryptSaltRounds?: number;
    cryptoSecret?: string; // Used to derive the AES-256-GCM key
    cryptoCipher?: string;
}

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

/**
 * The maximum number of bytes bcrypt reads from its input.
 *
 * Anything beyond this is silently ignored, so a longer password is
 * folded into a digest first.
 */
const BCRYPT_MAX_INPUT_BYTES = 72;

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
     * NO CONFIG REQUIRED: Generates a CRYPTOGRAPHICALLY SECURE random numeric string.
     */
    public randomNumber(length: number = 6): string {
        if (length <= 0) {return "";}
        let result = "";
        while (result.length < length) {
            const byte = crypto.randomBytes(1)[0];
            if (byte < 250) { // Keep uniform distribution
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
     * The material that is actually hashed.
     *
     * bcrypt ignores everything past 72 bytes, so a longer password
     * would silently lose its tail. Such a password is folded into a
     * SHA-256 digest first; the digest is 64 characters, so the whole
     * secret still fits.
     *
     * The rule depends only on the plaintext, so a hash created with
     * one rule verifies with the other.
     */
    private hashMaterial(plain: string): string {
        const byteLength = Buffer.byteLength(plain, "utf8");

        if (byteLength <= BCRYPT_MAX_INPUT_BYTES) {
            return plain;
        }

        return `sha256:${createHash("sha256").update(plain).digest("hex")}`;
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
        return bcrypt.hash(`${this.hashMaterial(plain)}.${pepper}`, salt);
    }

    /**
     * CONFIG OPTIONAL (Requires method parameter if constructor config missing)
     */
    public async compare(hashed: string, plain: string, secret?: string): Promise<boolean> {
        const pepper = secret ?? this.config.bcryptSecret;
        if (!pepper) {
            throw new Error("SecurityUtil Error: A bcrypt secret must be provided via constructor or function parameter.");
        }
        return bcrypt.compare(`${this.hashMaterial(plain)}.${pepper}`, hashed);
    }

    /**
     * Derives the 32-byte AES-256 key from the configured secret.
     *
     * HKDF-SHA-256 lets the deployment secret be any length >= 32
     * characters while still producing a key of the exact length
     * AES-256 requires.
     */
    private deriveKey(secret?: string): Buffer {
        const encryptionSecret = secret ?? this.config.cryptoSecret;

        if (!encryptionSecret) {
            throw new Error("SecurityUtil Error: A crypto secret must be provided via constructor or function parameter.");
        }

        if (encryptionSecret.length < 32) {
            throw new Error("SecurityUtil Error: The crypto secret must be at least 32 characters.");
        }

        return Buffer.from(
            crypto.hkdfSync(
                "sha256",
                Buffer.from(encryptionSecret, "utf-8"),
                Buffer.alloc(0),
                Buffer.from(HKDF_CONTEXT, "utf-8"),
                AES_KEY_LENGTH,
            ),
        );
    }

    /**
     * CONFIG OPTIONAL (Requires method parameter if constructor config missing)
     *
     * Authenticated encryption using AES-256-GCM.
     */
    public encrypt(data: string, secret?: string): string {
        const key = this.deriveKey(secret);
        const cipherAlgorithm = this.config.cryptoCipher ?? "aes-256-gcm";
        const iv = crypto.randomBytes(12); // GCM standard IV size is 12 bytes

        const cipher = crypto.createCipheriv(
            cipherAlgorithm,
            key,
            iv
        ) as crypto.CipherGCM;

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
    public decrypt(encryptedPayload: string, secret?: string): string {
        const key = this.deriveKey(secret);
        const cipherAlgorithm = this.config.cryptoCipher ?? "aes-256-gcm";

        const parts = encryptedPayload.split(":");

        if (parts.length !== 4 || parts[0] !== "v1") {
            throw new Error("Invalid encrypted payload structure");
        }

        const iv = Buffer.from(parts[1], "hex");
        const authTag = Buffer.from(parts[2], "hex");
        const encryptedText = Buffer.from(parts[3], "hex");

        const decipher = crypto.createDecipheriv(
            cipherAlgorithm,
            key,
            iv
        ) as crypto.DecipherGCM;

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
    public async shield(data: string): Promise<string> {
        return this.encrypt(data);
    }

    /**
     * Decrypts and verifies a cache payload.
     */
    public async unshield(message: string): Promise<string> {
        return this.decrypt(message);
    }
}
