// src/config/cluster.ts
import {DEFAULT_CLUSTER_WORKERS} from "./env.schema";

/**
 * Resolves the configured worker count.
 *
 * The environment schema already validates and defaults
 * `CLUSTER_WORKERS`, but keeping the guard here makes the startup path
 * safe for direct callers and prevents a non-finite value from ever
 * reaching `cluster.fork()`.
 */
export function resolveClusterWorkers(
    value: unknown,
    fallback: number = DEFAULT_CLUSTER_WORKERS,
): number {
    const parsed = Number(value);

    if (!Number.isFinite(parsed) || parsed < 1) {
        return fallback;
    }

    return Math.floor(parsed);
}

/**
 * Cluster mode is keyed to the parsed boolean, not the raw string.
 *
 * Comparing `__ENV.CLUSTER` to `"true"` made `CLUSTER=true` a no-op
 * because Joi converts the value to a boolean before it is exported.
 */
export function isClusterEnabled(clusterFlag: unknown): boolean {
    return clusterFlag === true;
}
