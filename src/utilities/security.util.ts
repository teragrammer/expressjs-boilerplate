import crypto from "crypto";
import bcrypt from "bcrypt";
import {__ENV} from "../configurations/environment";

export function SecurityUtil() {
    return {
        randomString(size: number = 32): string {
            return crypto.randomBytes(size).toString("hex");
        },

        randomNumber(length: number = 6): string {
            let result = "";
            for (let i = 0; i < length; i++) {
                result += Math.floor(Math.random() * 10).toString();
            }

            return result;
        },

        async hash(plain: string, secret: string | null = null): Promise<string> {
            secret = secret !== null ? secret : __ENV.BCRYPT_SECRET;
            const salt = await bcrypt.genSalt(__ENV.BCRYPT_SALT_ROUND);
            return await bcrypt.hash(`${plain}.${secret}`, salt);
        },

        async compare(hashed: string, plain: string, secret: string | null = null): Promise<boolean> {
            secret = secret !== null ? secret : __ENV.BCRYPT_SECRET;
            return await bcrypt.compare(`${plain}.${secret}`, hashed);
        },

        encrypt(data: string, secret: string | null = null): Promise<string> {
            return new Promise((resolve, reject) => {
                try {
                    secret = secret === null ? __ENV.CRYPT0_SECRET : secret;
                    const iv = crypto.randomBytes(__ENV.CRYPTO_IV);
                    const cipher = crypto.createCipheriv(__ENV.CRYPT0_CIPHER, Buffer.from(secret), iv);
                    const encrypted: Buffer = Buffer.concat([cipher.update(data), cipher.final()]);
                    let finale = iv.toString("hex") + ":" + encrypted.toString("hex");

                    resolve(finale);
                } catch (e) {
                    reject(e);
                }
            });
        },

        decrypt(encrypted: string, secret: string | null = null): Promise<any> {
            return new Promise((resolve, reject) => {
                try {
                    secret = secret === null ? __ENV.CRYPT0_SECRET : secret;
                    let textParts = encrypted.split(":");
                    let parts: any = textParts.shift();
                    let iv = Buffer.from(parts, "hex");
                    let encryptedText = Buffer.from(textParts.join(":"), "hex");
                    let decipher = crypto.createDecipheriv("aes-256-cbc", Buffer.from(secret), iv);
                    let decrypted = decipher.update(encryptedText);
                    decrypted = Buffer.concat([decrypted, decipher.final()]);
                    let finale = decrypted.toString();

                    resolve(finale);
                } catch (e) {
                    reject(e);
                }
            });
        },

        encodeBase64(data: string): string {
            let buff: Buffer = Buffer.from(data);
            return buff.toString("base64");
        },

        decodeBase64(data: string): string {
            let buff: Buffer = Buffer.from(data, "base64");
            return buff.toString("ascii");
        },

        encodeUrlBase64(data: string): string {
            return Buffer.from(data)
                .toString("base64") // Encode to Base64
                .replace(/\+/g, "-") // Replace '+' with '-'
                .replace(/\//g, "_") // Replace '/' with '_'
                .replace(/=+$/, ""); // Remove '=' padding
        },

        decodeUrlBase64(data: string): string {
            // Convert back to standard Base64
            const base64 = data
                .replace(/-/g, "+") // Replace '-' back to '+'
                .replace(/_/g, "/"); // Replace '_' back to '/'

            return Buffer.from(base64, "base64").toString();
        },
    };
}