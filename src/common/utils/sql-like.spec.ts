import {describe, expect, it} from "vitest";
import {escapeLikePattern} from "./sql-like";

describe("escapeLikePattern", () => {
    it("returns a plain value unchanged", () => {
        expect(escapeLikePattern("john")).toBe("john");
    });

    it("escapes backslashes", () => {
        expect(escapeLikePattern("a\\b")).toBe("a\\\\b");
    });

    it("escapes percent signs", () => {
        expect(escapeLikePattern("100%")).toBe("100\\%");
    });

    it("escapes underscores", () => {
        expect(escapeLikePattern("first_name")).toBe("first\\_name");
    });

    it("escapes every wildcard in one pass", () => {
        expect(escapeLikePattern("a\\%_b")).toBe("a\\\\\\%\\_b");
    });
});
