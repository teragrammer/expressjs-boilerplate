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
// __test__/security.util.spec.ts
const vitest_1 = require("vitest");
const security_util_1 = require("./security.util");
(0, vitest_1.describe)("SecurityUtil Edge Cases & Functional Tests", () => {
    const VALID_32_BYTE_SECRET = "12345678901234567890123456789012"; // AES-256 key must be exactly 32 bytes
    const VALID_BCRYPT_SECRET = "pepper-salt-pepper-salt";
    let secureUtilWithConfig;
    let secureUtilWithoutConfig;
    (0, vitest_1.beforeEach)(() => {
        secureUtilWithConfig = new security_util_1.SecurityUtil({
            bcryptSecret: VALID_BCRYPT_SECRET,
            bcryptSaltRounds: 4, // Set low for fast test execution
            cryptoSecret: VALID_32_BYTE_SECRET,
            cryptoCipher: "aes-256-gcm",
        });
        secureUtilWithoutConfig = new security_util_1.SecurityUtil(); // Testing parameter-less instantiation
    });
    // ==========================================
    // 1. STATELESS UTIL METHODS (No Config Required)
    // ==========================================
    (0, vitest_1.describe)("randomString()", () => {
        (0, vitest_1.it)("should return exactly the requested character length", () => {
            (0, vitest_1.expect)(secureUtilWithoutConfig.randomString(16)).toHaveLength(16);
            (0, vitest_1.expect)(secureUtilWithoutConfig.randomString(32)).toHaveLength(32);
        });
        (0, vitest_1.it)("should fallback to exactly 32 characters if no size parameter is passed", () => {
            (0, vitest_1.expect)(secureUtilWithoutConfig.randomString()).toHaveLength(32);
        });
        (0, vitest_1.it)("should handle boundary size of 0 safely", () => {
            (0, vitest_1.expect)(secureUtilWithoutConfig.randomString(0)).toBe("");
        });
    });
    (0, vitest_1.describe)("randomNumber()", () => {
        (0, vitest_1.it)("should return numerical-only values of correct length", () => {
            const length = 10;
            const res = secureUtilWithoutConfig.randomNumber(length);
            (0, vitest_1.expect)(res).toHaveLength(length);
            (0, vitest_1.expect)(/^\d+$/.test(res)).toBe(true);
        });
        (0, vitest_1.it)("should handle edge case lengths: 0 or negative values cleanly", () => {
            (0, vitest_1.expect)(secureUtilWithoutConfig.randomNumber(0)).toBe("");
            (0, vitest_1.expect)(secureUtilWithoutConfig.randomNumber(-5)).toBe("");
        });
    });
    (0, vitest_1.describe)("Base64 & Base64URL Encoding/Decoding", () => {
        const testPhrase = "Hello Node.js 2026? +&= /_ World!";
        const unicodePhrase = "🔒 Secure Emojis 🚀";
        (0, vitest_1.it)("should correctly handle standard Base64 roundtrip (including unicode characters)", () => {
            const encoded = secureUtilWithoutConfig.encodeBase64(unicodePhrase);
            const decoded = secureUtilWithoutConfig.decodeBase64(encoded);
            (0, vitest_1.expect)(decoded).toBe(unicodePhrase);
        });
        (0, vitest_1.it)("should eliminate unsafe characters like +, /, = in Base64URL encoding", () => {
            const encodedUrl = secureUtilWithoutConfig.encodeUrlBase64(testPhrase);
            (0, vitest_1.expect)(encodedUrl).not.toContain("+");
            (0, vitest_1.expect)(encodedUrl).not.toContain("/");
            (0, vitest_1.expect)(encodedUrl).not.toContain("=");
            const decoded = secureUtilWithoutConfig.decodeUrlBase64(encodedUrl);
            (0, vitest_1.expect)(decoded).toBe(testPhrase);
        });
    });
    // ==========================================
    // 2. STATEFUL CRYPTO METHODS (Config Validation & Fallbacks)
    // ==========================================
    (0, vitest_1.describe)("Missing Configuration Fallbacks & Custom Overrides", () => {
        (0, vitest_1.it)("should throw a descriptive error when calling hash() without configured/provided secrets", () => __awaiter(void 0, void 0, void 0, function* () {
            yield (0, vitest_1.expect)(secureUtilWithoutConfig.hash("plaintext"))
                .rejects
                .toThrow("A bcrypt secret must be provided");
        }));
        (0, vitest_1.it)("should succeed on hash() if secret override is supplied at runtime to an unconfigured utility", () => __awaiter(void 0, void 0, void 0, function* () {
            const result = yield secureUtilWithoutConfig.hash("plaintext", "runtime-pepper");
            (0, vitest_1.expect)(result).toBeDefined();
            const matches = yield secureUtilWithoutConfig.compare(result, "plaintext", "runtime-pepper");
            (0, vitest_1.expect)(matches).toBe(true);
        }));
        (0, vitest_1.it)("should throw descriptive error when calling encrypt() without configured/provided secrets", () => {
            (0, vitest_1.expect)(() => secureUtilWithoutConfig.encrypt("super-secret"))
                .toThrow("A crypto secret must be provided");
        });
    });
    (0, vitest_1.describe)("Hashing Integrity & Verification", () => {
        (0, vitest_1.it)("should successfully match valid string and reject invalid match strings", () => __awaiter(void 0, void 0, void 0, function* () {
            const plainText = "MyPa$$w0rd123";
            const hashed = yield secureUtilWithConfig.hash(plainText);
            (0, vitest_1.expect)(yield secureUtilWithConfig.compare(hashed, plainText)).toBe(true);
            (0, vitest_1.expect)(yield secureUtilWithConfig.compare(hashed, "WrongPa$$word")).toBe(false);
        }));
        (0, vitest_1.it)("should fail validation if verification is performed with an incorrect runtime pepper", () => __awaiter(void 0, void 0, void 0, function* () {
            const plainText = "MatchingData";
            const hashed = yield secureUtilWithConfig.hash(plainText);
            // Compare using a different/wrong pepper override
            (0, vitest_1.expect)(yield secureUtilWithConfig.compare(hashed, plainText, "incorrect-pepper-override")).toBe(false);
        }));
    });
    (0, vitest_1.describe)("Encryption & Decryption (AES-256-GCM Integrity)", () => {
        (0, vitest_1.it)("should encrypt and successfully decrypt data using symmetric secrets", () => {
            const sensitiveData = "DatabaseConnectionStringDetails_2026";
            const cipherText = secureUtilWithConfig.encrypt(sensitiveData);
            (0, vitest_1.expect)(cipherText).not.toBe(sensitiveData);
            (0, vitest_1.expect)(secureUtilWithConfig.decrypt(cipherText)).toBe(sensitiveData);
        });
        (0, vitest_1.it)("should throw error if encrypted string layout is malformed during split check", () => {
            (0, vitest_1.expect)(() => secureUtilWithConfig.decrypt("invalidPayloadWithoutColons"))
                .toThrow("Invalid encrypted payload structure");
        });
        (0, vitest_1.it)("should strictly throw error (MAC/Tag verification failure) if cipher payload or IV is tampered with", () => {
            const sensitiveData = "Confidential Information";
            const validCipherText = secureUtilWithConfig.encrypt(sensitiveData);
            const [iv, authTag, content] = validCipherText.split(":");
            // Alter a character in the ciphertext buffer representation to simulate tampering
            const tamperedContent = content.slice(0, -1) + (content.endsWith("a") ? "b" : "a");
            const tamperedPayload = `${iv}:${authTag}:${tamperedContent}`;
            (0, vitest_1.expect)(() => secureUtilWithConfig.decrypt(tamperedPayload))
                .toThrow(Error); // GCM automatically fails during tag validation on decipher.final()
        });
        (0, vitest_1.it)("should reject key sizes that are not exactly 32 bytes (256-bit)", () => {
            const invalidShortSecret = "short-key"; // 9 bytes
            const data = "Test Data";
            // Asserts that a standard Error is thrown, matching the key length warning
            (0, vitest_1.expect)(() => secureUtilWithConfig.encrypt(data, invalidShortSecret))
                .toThrow(Error);
        });
        (0, vitest_1.it)("should reject decryption if the GCM auth tag has been truncated (Short-Tag Forgery Prevention)", () => {
            const sensitiveData = "Confidential Payroll Data";
            const cipherText = secureUtilWithConfig.encrypt(sensitiveData);
            const [iv, authTag, content] = cipherText.split(":");
            // Attack scenario: Truncate the 16-byte auth tag down to 2 bytes (4 hex chars)
            const truncatedTag = authTag.substring(0, 4);
            const tamperedPayload = `${iv}:${truncatedTag}:${content}`;
            // Node.js crypto GCM will fail authentication check on decipher.final()
            (0, vitest_1.expect)(() => secureUtilWithConfig.decrypt(tamperedPayload))
                .toThrow(Error);
        });
        (0, vitest_1.it)("should seamlessly encrypt and decrypt highly complex unicode / multi-byte emojis", () => {
            const extremeUnicodeString = "こんにちは 🌟 🧑‍💻 Cryptographic Multi-Byte String Test 🚀";
            const cipherText = secureUtilWithConfig.encrypt(extremeUnicodeString);
            const decryptedText = secureUtilWithConfig.decrypt(cipherText);
            (0, vitest_1.expect)(decryptedText).toBe(extremeUnicodeString);
        });
    });
    // ==========================================
    // 3. PIPELINE SHIELDING TESTS (Combo Operations)
    // ==========================================
    (0, vitest_1.describe)("Shield and Unshield Pipelines", () => {
        const complexJSON = JSON.stringify({ userId: 101, scopes: ["admin", "write"] });
        (0, vitest_1.it)("should securely package complex payloads and restore them with exact structure", () => __awaiter(void 0, void 0, void 0, function* () {
            const shielded = yield secureUtilWithConfig.shield(complexJSON);
            // Check that it returned a valid base64url string (no slashes/plus signs)
            (0, vitest_1.expect)(shielded).not.toContain("/");
            (0, vitest_1.expect)(shielded).not.toContain("+");
            const unshielded = yield secureUtilWithConfig.unshield(shielded);
            (0, vitest_1.expect)(unshielded).toBe(complexJSON);
        }));
        (0, vitest_1.it)("should fail integrity check if shielded envelope JSON was modified to simulate attacker tampering", () => __awaiter(void 0, void 0, void 0, function* () {
            const shielded = yield secureUtilWithConfig.shield("PlainPayload");
            // Unpack envelope structure, tamper hash validation mapping, repack
            const rawDecoded = secureUtilWithoutConfig.decodeUrlBase64(shielded);
            const parsedEnvelope = JSON.parse(rawDecoded);
            // Swapping validation hash to another arbitrary valid bcrypt payload format
            parsedEnvelope.hashed = yield secureUtilWithConfig.hash("ACompletelyDifferentString");
            const tamperedShielded = secureUtilWithoutConfig.encodeUrlBase64(JSON.stringify(parsedEnvelope));
            yield (0, vitest_1.expect)(secureUtilWithConfig.unshield(tamperedShielded))
                .rejects
                .toThrow("Data integrity check failed");
        }));
    });
});
