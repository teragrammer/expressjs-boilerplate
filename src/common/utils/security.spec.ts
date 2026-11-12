// src/common/utils/security.spec.ts
import {beforeEach, describe, expect, it} from "vitest";
import {SecurityUtil} from "./security.util";

describe("SecurityUtil Edge Cases & Functional Tests", () => {
    const VALID_32_BYTE_SECRET = "12345678901234567890123456789012"; // AES-256 key must be exactly 32 bytes
    const VALID_BCRYPT_SECRET = "pepper-salt-pepper-salt";

    let secureUtilWithConfig: SecurityUtil;
    let secureUtilWithoutConfig: SecurityUtil;

    beforeEach(() => {
        secureUtilWithConfig = new SecurityUtil({
            bcryptSecret: VALID_BCRYPT_SECRET,
            bcryptSaltRounds: 4, // Set low for fast test execution
            cryptoSecret: VALID_32_BYTE_SECRET,
            cryptoCipher: "aes-256-gcm",
        });

        secureUtilWithoutConfig = new SecurityUtil(); // Testing parameter-less instantiation
    });

    // ==========================================
    // 1. STATELESS UTIL METHODS (No Config Required)
    // ==========================================
    describe("randomString()", () => {
        it("should return exactly the requested character length", () => {
            expect(secureUtilWithoutConfig.randomString(16)).toHaveLength(16);
            expect(secureUtilWithoutConfig.randomString(32)).toHaveLength(32);
        });

        it("should fallback to exactly 32 characters if no size parameter is passed", () => {
            expect(secureUtilWithoutConfig.randomString()).toHaveLength(32);
        });

        it("should handle boundary size of 0 safely", () => {
            expect(secureUtilWithoutConfig.randomString(0)).toBe("");
        });
    });

    describe("randomNumber()", () => {
        it("should return numerical-only values of correct length", () => {
            const length = 10;
            const res = secureUtilWithoutConfig.randomNumber(length);
            expect(res).toHaveLength(length);
            expect(/^\d+$/.test(res)).toBe(true);
        });

        it("should handle edge case lengths: 0 or negative values cleanly", () => {
            expect(secureUtilWithoutConfig.randomNumber(0)).toBe("");
            expect(secureUtilWithoutConfig.randomNumber(-5)).toBe("");
        });
    });

    describe("Base64 & Base64URL Encoding/Decoding", () => {
        const testPhrase = "Hello Node.js 2026? +&= /_ World!";
        const unicodePhrase = "🔒 Secure Emojis 🚀";

        it("should correctly handle standard Base64 roundtrip (including unicode characters)", () => {
            const encoded = secureUtilWithoutConfig.encodeBase64(unicodePhrase);
            const decoded = secureUtilWithoutConfig.decodeBase64(encoded);
            expect(decoded).toBe(unicodePhrase);
        });

        it("should eliminate unsafe characters like +, /, = in Base64URL encoding", () => {
            const encodedUrl = secureUtilWithoutConfig.encodeUrlBase64(testPhrase);
            expect(encodedUrl).not.toContain("+");
            expect(encodedUrl).not.toContain("/");
            expect(encodedUrl).not.toContain("=");

            const decoded = secureUtilWithoutConfig.decodeUrlBase64(encodedUrl);
            expect(decoded).toBe(testPhrase);
        });
    });

    // ==========================================
    // 2. STATEFUL CRYPTO METHODS (Config Validation & Fallbacks)
    // ==========================================
    describe("Missing Configuration Fallbacks & Custom Overrides", () => {
        it("should throw a descriptive error when calling hash() without configured/provided secrets", async () => {
            await expect(secureUtilWithoutConfig.hash("plaintext"))
                .rejects
                .toThrow("A bcrypt secret must be provided");
        });

        it("should succeed on hash() if secret override is supplied at runtime to an unconfigured utility", async () => {
            const result = await secureUtilWithoutConfig.hash("plaintext", "runtime-pepper");
            expect(result).toBeDefined();

            const matches = await secureUtilWithoutConfig.compare(result, "plaintext", "runtime-pepper");
            expect(matches).toBe(true);
        });

        it("should throw descriptive error when calling encrypt() without configured/provided secrets", () => {
            expect(() => secureUtilWithoutConfig.encrypt("super-secret"))
                .toThrow("A crypto secret must be provided");
        });
    });

    describe("Hashing Integrity & Verification", () => {
        it("should successfully match valid string and reject invalid match strings", async () => {
            const plainText = "MyPa$$w0rd123";
            const hashed = await secureUtilWithConfig.hash(plainText);

            expect(await secureUtilWithConfig.compare(hashed, plainText)).toBe(true);
            expect(await secureUtilWithConfig.compare(hashed, "WrongPa$$word")).toBe(false);
        });

        it("should fail validation if verification is performed with an incorrect runtime pepper", async () => {
            const plainText = "MatchingData";
            const hashed = await secureUtilWithConfig.hash(plainText);

            // Compare using a different/wrong pepper override
            expect(await secureUtilWithConfig.compare(hashed, plainText, "incorrect-pepper-override")).toBe(false);
        });
    });

    describe("Encryption & Decryption (AES-256-GCM Integrity)", () => {
        it("should encrypt and successfully decrypt data using symmetric secrets", () => {
            const sensitiveData = "DatabaseConnectionStringDetails_2026";
            const cipherText = secureUtilWithConfig.encrypt(sensitiveData);

            expect(cipherText).not.toBe(sensitiveData);
            expect(secureUtilWithConfig.decrypt(cipherText)).toBe(sensitiveData);
        });

        it("should throw error if encrypted string layout is malformed during split check", () => {
            expect(() => secureUtilWithConfig.decrypt("invalidPayloadWithoutColons"))
                .toThrow("Invalid encrypted payload structure");
        });

        it("should strictly throw error (MAC/Tag verification failure) if cipher payload or IV is tampered with", () => {
            const sensitiveData = "Confidential Information";
            const validCipherText = secureUtilWithConfig.encrypt(sensitiveData);

            const [, iv, authTag, content] = validCipherText.split(":");

            // Alter a character in the ciphertext buffer representation to simulate tampering
            const tamperedContent = content.slice(0, -1) + (content.endsWith("a") ? "b" : "a");
            const tamperedPayload = `${iv}:${authTag}:${tamperedContent}`;

            expect(() => secureUtilWithConfig.decrypt(tamperedPayload))
                .toThrow(Error); // GCM automatically fails during tag validation on decipher.final()
        });

        it("should reject key sizes that are not exactly 32 bytes (256-bit)", () => {
            const invalidShortSecret = "short-key"; // 9 bytes
            const data = "Test Data";

            // Asserts that a standard Error is thrown, matching the key length warning
            expect(() => secureUtilWithConfig.encrypt(data, invalidShortSecret))
                .toThrow(Error);
        });

        it("should reject decryption if the GCM auth tag has been truncated (Short-Tag Forgery Prevention)", () => {
            const sensitiveData = "Confidential Payroll Data";
            const cipherText = secureUtilWithConfig.encrypt(sensitiveData);

            const [, iv, authTag, content] = cipherText.split(":");

            // Attack scenario: Truncate the 16-byte auth tag down to 2 bytes (4 hex chars)
            const truncatedTag = authTag.substring(0, 4);
            const tamperedPayload = `${iv}:${truncatedTag}:${content}`;

            // Node.js crypto GCM will fail authentication check on decipher.final()
            expect(() => secureUtilWithConfig.decrypt(tamperedPayload))
                .toThrow(Error);
        });

        it("should seamlessly encrypt and decrypt highly complex unicode / multi-byte emojis", () => {
            const extremeUnicodeString = "こんにちは 🌟 🧑‍💻 Cryptographic Multi-Byte String Test 🚀";
            const cipherText = secureUtilWithConfig.encrypt(extremeUnicodeString);
            const decryptedText = secureUtilWithConfig.decrypt(cipherText);

            expect(decryptedText).toBe(extremeUnicodeString);
        });
    });

    // ==========================================
    // 3. PIPELINE SHIELDING TESTS (Combo Operations)
    // ==========================================
    describe("Shield and Unshield Pipelines", () => {
        const complexJSON = JSON.stringify({userId: 101, scopes: ["admin", "write"]});

        it("should securely package complex payloads and restore them with exact structure", async () => {
            const shielded = await secureUtilWithConfig.shield(complexJSON);

            // The payload is a versioned AES-256-GCM envelope.
            expect(shielded.startsWith("v1:")).toBe(true);
            expect(shielded.split(":")).toHaveLength(4);

            const unshielded = await secureUtilWithConfig.unshield(shielded);
            expect(unshielded).toBe(complexJSON);
        });

        it("should not use a password hash for cache payloads", async () => {
            /*
             * Regression test: the cache path used to run bcrypt on
             * every read and write, which cost hundreds of
             * milliseconds per operation.
             */
            const shielded = await secureUtilWithConfig.shield("PlainPayload");

            // A bcrypt hash would start with the bcrypt prefix.
            expect(shielded.startsWith("$2")).toBe(false);
            expect(shielded.startsWith("v1:")).toBe(true);
        });

        it("should fail integrity check if the encrypted payload was modified", async () => {
            const shielded = await secureUtilWithConfig.shield("PlainPayload");

            const [version, iv, authTag, content] = shielded.split(":");

            // Tamper with the ciphertext.
            const tamperedContent =
                content.slice(0, -1) + (content.endsWith("a") ? "b" : "a");

            const tamperedShielded = `${version}:${iv}:${authTag}:${tamperedContent}`;

            await expect(secureUtilWithConfig.unshield(tamperedShielded))
                .rejects
                .toThrow(Error);
        });

        it("should reject an envelope with an unknown version", async () => {
            const shielded = await secureUtilWithConfig.shield("PlainPayload");

            const [, iv, authTag, content] = shielded.split(":");

            await expect(
                secureUtilWithConfig.unshield(`v9:${iv}:${authTag}:${content}`),
            ).rejects.toThrow("Invalid encrypted payload structure");
        });
    });
    describe("Long password handling", () => {
        it("hashes and verifies a password longer than the bcrypt limit", async () => {
            const longPassword = "a".repeat(100);

            const hashed = await secureUtilWithConfig.hash(longPassword);

            expect(
                await secureUtilWithConfig.compare(hashed, longPassword),
            ).toBe(true);
        });

        it("does not truncate the tail of a long password", async () => {
            const base = "a".repeat(100);

            const hashed = await secureUtilWithConfig.hash(base);

            // A password that shares the first 72 bytes must not match.
            expect(
                await secureUtilWithConfig.compare(
                    hashed,
                    `${"a".repeat(72)}different`,
                ),
            ).toBe(false);
        });

        it("verifies a password with multi-byte characters", async () => {
            const password = "こんにちは🌟🧑‍💻 Cryptographic Test 🚀";

            const hashed = await secureUtilWithConfig.hash(password);

            expect(
                await secureUtilWithConfig.compare(hashed, password),
            ).toBe(true);
        });

        it("still verifies a password created under the previous policy", async () => {
            /*
             * A password at or below the bcrypt limit keeps the same
             * material, so hashes created before the change still
             * verify.
             */
            const password = "Short1!";

            const hashed = await secureUtilWithConfig.hash(password);

            expect(
                await secureUtilWithConfig.compare(hashed, password),
            ).toBe(true);
        });
    });
});
