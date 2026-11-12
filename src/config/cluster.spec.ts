// src/config/cluster.spec.ts
import {describe, expect, it} from "vitest";

import {isClusterEnabled, resolveClusterWorkers} from "./cluster";
import {createEnvSchema, DEFAULT_CLUSTER_WORKERS} from "./env.schema";

describe("resolveClusterWorkers", () => {
    it("uses a positive numeric value", () => {
        expect(resolveClusterWorkers(4)).toBe(4);
        expect(resolveClusterWorkers("3")).toBe(3);
    });

    it("falls back to the CPU count for empty or invalid values", () => {
        expect(resolveClusterWorkers(undefined)).toBe(
            DEFAULT_CLUSTER_WORKERS,
        );
        expect(resolveClusterWorkers("")).toBe(DEFAULT_CLUSTER_WORKERS);
        expect(resolveClusterWorkers("not-a-number")).toBe(
            DEFAULT_CLUSTER_WORKERS,
        );
        expect(resolveClusterWorkers(0)).toBe(DEFAULT_CLUSTER_WORKERS);
        expect(resolveClusterWorkers(-1)).toBe(DEFAULT_CLUSTER_WORKERS);
    });

    it("uses an explicit fallback when provided", () => {
        expect(resolveClusterWorkers(undefined, 2)).toBe(2);
    });
});

describe("isClusterEnabled", () => {
    it("enables cluster mode for the parsed boolean true", () => {
        expect(isClusterEnabled(true)).toBe(true);
    });

    it("does not compare against the raw string value", () => {
        expect(isClusterEnabled("true")).toBe(false);
    });

    it("keeps cluster mode disabled for false and undefined", () => {
        expect(isClusterEnabled(false)).toBe(false);
        expect(isClusterEnabled(undefined)).toBe(false);
    });

    it("regression: CLUSTER=true in the environment enables cluster mode", () => {
        const {value, error} = createEnvSchema(true).validate({
            CLUSTER: "true",
        });

        expect(error).toBeUndefined();
        expect(value.CLUSTER).toBe(true);
        expect(isClusterEnabled(value.CLUSTER)).toBe(true);
    });
});
