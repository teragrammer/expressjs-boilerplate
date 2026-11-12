// scripts/openapi-lint.ts
/**
 * Validates the OpenAPI contract.
 *
 * The script checks two things:
 * 1. The document is well-formed YAML with the required top-level
 *    fields and that every path operation has a response.
 * 2. Every path declared in the contract exists in the application
 *    router, and every application route is documented.
 *
 * The second check is what keeps the contract from drifting away from
 * the implementation.
 */
import fs from "node:fs";
import path from "node:path";

const SPEC_PATH = path.join(__dirname, "..", "docs", "openapi.yaml");

/**
 * Minimal YAML reader for the subset used by the contract.
 *
 * The project has no YAML dependency, and adding one for a lint step
 * would be a heavier change than the check justifies. The parser
 * understands the block mappings, block sequences and scalars the
 * contract uses.
 */
function parseYaml(source: string): any {
    const lines: string[] = source
        .split("\n")
        .map((line) => line.replace(/\t/g, "  "))
        .filter((line) => line.trim() !== "" && !/^\s*#/.test(line));

    let index = 0;

    function indentOf(line: string): number {
        return line.length - line.trimStart().length;
    }

    function parseScalar(raw: string): any {
        const value = raw.trim();

        if (value === "" || value === "|" || value === ">") {
            return value === "" ? null : value;
        }

        if (value === "true") {return true;}
        if (value === "false") {return false;}
        if (value === "null" || value === "~") {return null;}

        if (
            (value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))
        ) {
            return value.slice(1, -1);
        }

        if (/^-?\d+$/.test(value)) {return Number(value);}
        if (/^-?\d*\.\d+$/.test(value)) {return Number(value);}

        if (value.startsWith("[") && value.endsWith("]")) {
            const inner = value.slice(1, -1).trim();

            return inner === ""
                ? []
                : inner.split(",").map((item) => parseScalar(item));
        }

        if (value.startsWith("{") && value.endsWith("}")) {
            const inner = value.slice(1, -1).trim();

            if (inner === "") {return {};}

            return Object.fromEntries(
                inner.split(",").map((entry) => {
                    const [key, ...rest] = entry.split(":");

                    return [key.trim(), parseScalar(rest.join(":"))];
                }),
            );
        }

        return value;
    }

    function parseBlock(minIndent: number): any {
        // Determine whether this is a sequence or a mapping.
        if (index >= lines.length) {return null;}

        const currentIndent = indentOf(lines[index]);

        if (lines[index].trimStart().startsWith("- ")) {
            const items: any[] = [];

            while (
                index < lines.length &&
                indentOf(lines[index]) === currentIndent &&
                lines[index].trimStart().startsWith("- ")
            ) {
                const rest = lines[index]
                    .trimStart()
                    .slice(2)
                    .trim();

                index += 1;

                if (rest === "") {
                    items.push(parseBlock(currentIndent + 1));
                } else if (/^[\w".-]+:(\s|$)/.test(rest)) {
                    // Inline mapping entry: treat the rest as the first
                    // key of a nested mapping.
                    const nested: Record<string, any> = {};

                    const separator = rest.indexOf(":");
                    const key = rest.slice(0, separator).trim();
                    const value = rest.slice(separator + 1).trim();

                    nested[key] =
                        value === ""
                            ? parseBlock(currentIndent + 1)
                            : parseScalar(value);

                    // Sibling keys of the same list item.
                    while (
                        index < lines.length &&
                        indentOf(lines[index]) > currentIndent
                    ) {
                        const siblingIndent = indentOf(lines[index]);
                        const siblingText = lines[index].trim();

                        if (siblingText.startsWith("- ")) {break;}

                        index += 1;

                        const sep = siblingText.indexOf(":");
                        const siblingKey = siblingText
                            .slice(0, sep)
                            .trim();
                        const siblingValue = siblingText
                            .slice(sep + 1)
                            .trim();

                        nested[siblingKey] =
                            siblingValue === ""
                                ? parseBlock(siblingIndent + 1)
                                : parseScalar(siblingValue);
                    }

                    items.push(nested);
                } else {
                    items.push(parseScalar(rest));
                }
            }

            return items;
        }

        const mapping: Record<string, any> = {};

        while (
            index < lines.length &&
            indentOf(lines[index]) >= minIndent
        ) {
            const line = lines[index];
            const lineIndent = indentOf(line);
            const text = line.trim();

            if (text.startsWith("- ")) {break;}

            const separator = text.indexOf(":");
            const key = text.slice(0, separator).trim();
            const rawValue = text.slice(separator + 1).trim();

            index += 1;

            if (rawValue === "" || rawValue === "|" || rawValue === ">") {
                if (rawValue === "") {
                    mapping[key] = parseBlock(lineIndent + 1);
                } else {
                    // Literal block scalar.
                    const block = [];

                    while (
                        index < lines.length &&
                        indentOf(lines[index]) > lineIndent
                    ) {
                        block.push(lines[index].trim());
                        index += 1;
                    }

                    mapping[key] = block.join("\n");
                }
            } else {
                mapping[key] = parseScalar(rawValue);
            }
        }

        return mapping;
    }

    return parseBlock(0);
}

/**
 * Builds the route inventory of the application.
 *
 * Express 5 does not expose the mount path of a `router.use()` layer,
 * so the `Router` prototype is instrumented before the routers are
 * imported: every route registration is recorded on the router
 * instance, and every mount path is attached to the mounted router.
 */
function instrumentRouter(): void {
    /*
     * Express 5 delegates its router to the `router` package. The
     * prototype is patched before the routers are imported so every
     * registration is recorded.
     */
    /*
     * The router prototype is patched at runtime, so the module is
     * loaded dynamically rather than through a static import.
     */
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Router = require("router");

    const prototype = Router.prototype ?? Router;

    const methods = ["get", "post", "put", "patch", "delete"] as const;

    for (const method of methods) {
        const original = prototype[method];

        prototype[method] = function instrumented(this: any, ...args: any[]) {
            const routePath = typeof args[0] === "string" ? args[0] : "/";

            if (!Array.isArray(this.__routes)) {
                this.__routes = [];
            }

            this.__routes.push({method: method.toUpperCase(), path: routePath});

            return original.apply(this, args);
        };
    }

    const originalUse = prototype.use;

    /*
     * A router instance is a callable that carries a `stack`. The
     * `stack` property only exists once a route has been registered,
     * so the `instanceof` check is used as the primary signal.
     */
    const isRouter = (value: unknown): boolean =>
        typeof value === "function" &&
        (value instanceof Router ||
            Array.isArray((value as {stack?: unknown[]}).stack));

    prototype.use = function instrumentedUse(this: any, ...args: any[]) {
        const mountPath = typeof args[0] === "string" ? args[0] : "";

        const handler = args.find(isRouter);

        if (handler) {
            (handler as {__mountPath?: string}).__mountPath = mountPath;
        }

        return originalUse.apply(this, args);
    };
}

/**
 * Collects the route paths declared by the Express routers.
 *
 * The routers are imported directly: importing them does not start a
 * server or connect to the database.
 */
async function collectApplicationRoutes(): Promise<string[]> {
    instrumentRouter();

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const v1 = require("../src/routes/v1").default;

    const router = v1();
    const routes: string[] = [];

    /**
     * Converts an Express path into the OpenAPI path syntax.
     *
     * Express uses `:id` for a path parameter; OpenAPI uses `{id}`.
     */
    const toOpenApiPath = (routePath: string): string =>
        routePath.replace(/:([A-Za-z0-9_]+)/g, "{$1}");

    const walk = (instance: any, prefix: string): void => {
        for (const route of instance.__routes ?? []) {
            const routePath = `${prefix}${
                route.path === "/" ? "" : route.path
            }`;

            routes.push(`${route.method} ${toOpenApiPath(routePath)}`);
        }
    };

    const collect = (instance: any, prefix: string): void => {
        walk(instance, prefix);

        for (const layer of instance.stack ?? []) {
            const handle = layer.handle;

            if (!handle || !Array.isArray(handle.stack)) {
                continue;
            }

            const mount =
                typeof handle.__mountPath === "string" &&
                handle.__mountPath !== "/"
                    ? handle.__mountPath
                    : "";

            collect(handle, `${prefix}${mount}`);
        }
    };
    collect(router, "/api/v1");

    return routes;
}

async function main(): Promise<void> {
    if (!fs.existsSync(SPEC_PATH)) {
        console.error(`OpenAPI contract not found at ${SPEC_PATH}`);
        process.exit(1);
    }

    const source = fs.readFileSync(SPEC_PATH, "utf-8");
    const spec = parseYaml(source);

    const errors: string[] = [];

    for (const field of ["openapi", "info", "paths"]) {
        if (!spec[field]) {
            errors.push(`The contract is missing the '${field}' field.`);
        }
    }

    if (spec.openapi && !String(spec.openapi).startsWith("3.")) {
        errors.push(
            `The contract must declare an OpenAPI 3.x version, found '${spec.openapi}'.`,
        );
    }

    const paths: Record<string, Record<string, any>> = spec.paths ?? {};

    for (const [routePath, operations] of Object.entries(paths)) {
        if (!routePath.startsWith("/")) {
            errors.push(`Path '${routePath}' must start with a slash.`);
        }

        for (const [method, operation] of Object.entries(operations)) {
            if (!["get", "post", "put", "patch", "delete"].includes(method)) {
                continue;
            }

            if (!operation.responses || Object.keys(operation.responses).length === 0) {
                errors.push(
                    `'${method.toUpperCase()} ${routePath}' declares no responses.`,
                );
            }
        }
    }

    /*
     * Compare the contract with the application routes.
     *
     * The contract is relative to the `/api/v1` server root, so the
     * prefix is stripped from the application routes before the
     * comparison.
     */
    const applicationRoutes = await collectApplicationRoutes();

    const documented = new Set<string>();

    for (const [routePath, operations] of Object.entries(paths)) {
        for (const method of Object.keys(operations)) {
            if (!["get", "post", "put", "patch", "delete"].includes(method)) {
                continue;
            }

            documented.add(`${method.toUpperCase()} ${routePath}`);
        }
    }

    // Health and metrics live outside the versioned API.
    const operational = new Set<string>([
        "GET /health/live",
        "GET /health/ready",
    ]);

    const stripPrefix = (route: string): string =>
        route.replace(/^\/api\/v1/, "") || "/";

    for (const route of applicationRoutes) {
        if (operational.has(route)) {continue;}

        const separator = route.indexOf(" ");
        const method = route.slice(0, separator);
        const routePath = route.slice(separator + 1);

        const normalized = `${method} ${stripPrefix(routePath)}`;

        if (!documented.has(normalized)) {
            errors.push(`The route '${route}' is not documented.`);
        }
    }

    for (const route of documented) {
        if (
            route.startsWith("GET /health") ||
            route === "GET /metrics"
        ) {continue;}

        const separator = route.indexOf(" ");
        const method = route.slice(0, separator);
        const routePath = route.slice(separator + 1);

        const applicationRoute = `/api/v1${
            routePath === "/" ? "" : routePath
        }`;

        if (!applicationRoutes.includes(`${method} ${applicationRoute}`)) {
            errors.push(
                `The contract documents '${route}', which the application does not expose.`,
            );
        }
    }

    if (errors.length > 0) {
        console.error("OpenAPI contract validation failed:");
        errors.forEach((error) => console.error(`  - ${error}`));
        process.exit(1);
    }

    console.log(
        `OpenAPI contract is valid: ${documented.size} documented operations match the application routes.`,
    );

    process.exit(0);
}

void main().catch((error: unknown) => {
    console.error("OpenAPI lint failed:", error);
    process.exit(1);
});
