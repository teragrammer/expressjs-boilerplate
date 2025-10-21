import {expect} from "chai";
import {SecurityUtil} from "../../src/utilities/security.util";

describe("security.util.ts", () => {
    it("hashing correctly", async () => {
        const plain = "123456.secret";
        const hashed = await SecurityUtil().hash(plain);

        expect(true).to.equal(await SecurityUtil().compare(hashed, plain));
    });

    it("encrypting and decrypting", async () => {
        const plain = "123456.secret.123456.SECRET";
        const encrypted = await SecurityUtil().encrypt(plain);

        expect(plain).to.equal(await SecurityUtil().decrypt(encrypted));
    });

    it("encode and decode text correctly", () => {
        const plain = "this is a test base64";
        const encode = SecurityUtil().encodeBase64(plain);
        const decoded = SecurityUtil().decodeBase64(encode);

        expect(plain).to.equal(decoded);
    });

    it("encode and decode text safe url correctly", () => {
        const plain = "this is a test base64url";
        const encode = SecurityUtil().encodeUrlBase64(plain);
        const decoded = SecurityUtil().decodeUrlBase64(encode);

        expect(plain).to.equal(decoded);
    });
});